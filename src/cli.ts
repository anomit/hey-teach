/**
 * Claude Code–shaped readline REPL: turns, slash commands, tool traces.
 * See: docs/ARCHITECTURE.md (CLI), docs/SESSIONS.md, README.md
 */

import "dotenv/config";
import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { MockClient } from "./model/mock-client.js";
import { NimClient, NIM_BASE_URL } from "./model/nim-client.js";
import { runNimDoctor } from "./model/nim-doctor.js";
import type { ModelClient } from "./model/types.js";
import {
  applyStarterFiles,
  defaultLessonId,
  getLesson,
  listLessons,
} from "./lessons/registry.js";
import { ansi, colorizeUnifiedDiff } from "./cli/ansi.js";
import { printBanner } from "./cli/banner.js";
import { StatusLine } from "./cli/status-line.js";
import { Session } from "./session.js";
import { exportTrajectories } from "./export/trajectories.js";
import {
  formatOutcomeColumn,
  isOutcome,
  OUTCOMES,
} from "./session-outcome.js";
import {
  createSessionId,
  listSessionSummaries,
  openSessionStore,
  SessionStore,
  type SessionOpenMode,
} from "./session-store.js";
import { createDefaultToolRegistry } from "./tools/registry.js";
import { TurnLoop, type ToolTrace } from "./turn-loop.js";

type ModelMode = "mock" | "nim";

function teacherModelLabel(mode: ModelMode): string {
  if (mode === "mock") return "mock";
  return process.env.NIM_MODEL?.trim() || "meta/llama-3.1-8b-instruct";
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const mode = parseModelMode(argv);
  const sessionMode = parseSessionMode(argv);
  const workspaceRoot = process.cwd();
  const tools = createDefaultToolRegistry();
  const mock = new MockClient();
  const model = createModel(mode, mock);
  const teacherModel = teacherModelLabel(mode);

  let lessonId = defaultLessonId();
  let lesson = getLesson(lessonId);

  let { store, messages, resumed } = await openSessionStore(
    workspaceRoot,
    lessonId,
    sessionMode,
    { teacherModel },
  );

  // Prefer lesson from resumed summary when present
  const summary = await store.readSummary();
  if (summary?.lessonId && getLesson(summary.lessonId)) {
    lessonId = summary.lessonId;
    lesson = getLesson(lessonId);
  }

  let session = new Session({
    workspaceRoot,
    activeLessonId: lessonId,
    id: store.id,
    store,
    messages,
  });

  if (lesson) {
    const written = await applyStarterFiles(lesson, workspaceRoot);
    if (written.length) {
      console.log(`Starter files written: ${written.join(", ")}`);
    }
  }

  printBanner({
    mode,
    lessonId,
    workspaceRoot,
    folder: path.basename(workspaceRoot),
    sessionId: session.id,
    sessionNote: resumed
      ? `resumed (${messages.length} messages)`
      : "new session",
  });

  // for-await over readline (not question()) so piped smoke tests work
  const rl = readline.createInterface({
    input,
    output,
    terminal: Boolean(input.isTTY),
    crlfDelay: Infinity,
  });

  const help = () => {
    console.log(`Commands:
  /lesson [id]     List lessons, or activate one
  /tools           List tools
  /sessions        List saved sessions (* = active)
  /outcome <label> Set outcome: ${OUTCOMES.join("|")} [note]
  /evaluate        Run lesson grader; update outcome
  /export [filter] Export trajectories (active|all|green|red|…)
  /new             Start a fresh session (keep old on disk)
  /doctor          Probe NIM endpoint + model
  /clear           Clear conversation history (same session id)
  /help            Show this help
  /quit            Exit

Flags: --model mock|nim   --new   --session <id>
Headless export: npm run export -- --all`);
  };

  try {
    output.write("> ");
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) {
        output.write("> ");
        continue;
      }

      if (trimmed.startsWith("/")) {
        const [cmd, ...rest] = trimmed.slice(1).split(/\s+/);
        const arg = rest.join(" ").trim();

        if (cmd === "quit" || cmd === "exit" || cmd === "q") {
          console.log("Bye.");
          break;
        }
        if (cmd === "help" || cmd === "h" || cmd === "?") {
          help();
          output.write("> ");
          continue;
        }
        if (cmd === "tools") {
          for (const t of tools.list()) {
            console.log(`  ${t.name} — ${t.description}`);
          }
          output.write("> ");
          continue;
        }
        if (cmd === "sessions") {
          const all = await listSessionSummaries(workspaceRoot);
          if (all.length === 0) {
            console.log("No sessions yet.");
          } else {
            for (const s of all) {
              const mark = s.id === session.id ? "*" : " ";
              const oc = formatOutcomeColumn(s.outcome);
              console.log(
                `${mark} ${s.id}  ${oc.padEnd(9)}  msgs=${s.messageCount}  lesson=${s.lessonId}  ${s.updatedAt}`,
              );
            }
          }
          output.write("> ");
          continue;
        }
        if (cmd === "outcome") {
          const [label, ...noteParts] = arg.split(/\s+/);
          if (!label || !isOutcome(label)) {
            console.log(`Usage: /outcome ${OUTCOMES.join("|")} [note]`);
            output.write("> ");
            continue;
          }
          const note = noteParts.join(" ").trim() || undefined;
          const updated = store.setOutcome(label, "manual", note);
          console.log(
            `Outcome → ${updated.outcome} (manual)${note ? ` — ${note}` : ""}`,
          );
          output.write("> ");
          continue;
        }
        if (cmd === "evaluate") {
          if (!lesson?.evaluate) {
            console.log("Active lesson has no evaluate() grader.");
            output.write("> ");
            continue;
          }
          const status = new StatusLine();
          status.start(`Evaluating ${lesson.id}…`);
          try {
            const result = await lesson.evaluate({ workspaceRoot });
            status.stop();
            const outcome = result.passed ? "green" : "red";
            store.setOutcome(outcome, "lesson_evaluate", result.feedback.slice(0, 200));
            console.log(
              result.passed
                ? ansi.green(`evaluate → green`)
                : ansi.red(`evaluate → red`),
            );
            console.log(result.feedback.slice(0, 600));
          } catch (err) {
            status.stop();
            store.setOutcome(
              "error",
              "lesson_evaluate",
              err instanceof Error ? err.message : String(err),
            );
            console.error(
              ansi.red(err instanceof Error ? err.message : String(err)),
            );
          }
          output.write("> ");
          continue;
        }
        if (cmd === "export") {
          const filter = arg || "active";
          try {
            const result = await exportTrajectories({
              workspaceRoot,
              activeSessionId: session.id,
              filter,
            });
            console.log(
              `Exported ${result.count} session(s) → ${result.path}`,
            );
            console.log(`Outcomes: ${JSON.stringify(result.outcomes)}`);
          } catch (err) {
            console.error(
              ansi.red(err instanceof Error ? err.message : String(err)),
            );
          }
          output.write("> ");
          continue;
        }
        if (cmd === "new") {
          store = new SessionStore(workspaceRoot, createSessionId());
          await store.init(session.activeLessonId, { teacherModel });
          session = new Session({
            workspaceRoot,
            activeLessonId: session.activeLessonId,
            id: store.id,
            store,
            messages: [],
          });
          mock.reset();
          console.log(`New session: ${session.id}`);
          output.write("> ");
          continue;
        }
        if (cmd === "clear") {
          session.clear();
          mock.reset();
          console.log(`History cleared (session ${session.id}).`);
          output.write("> ");
          continue;
        }
        if (cmd === "doctor") {
          const status = new StatusLine();
          status.start("Running NIM doctor…");
          try {
            const modelName =
              process.env.NIM_MODEL?.trim() || "meta/llama-3.1-8b-instruct";
            const report = await runNimDoctor({
              apiKey: process.env.NVIDIA_API_KEY,
              model: modelName,
              baseURL: NIM_BASE_URL,
            });
            status.stop();
            printDoctorReport(report);
          } catch (err) {
            status.stop();
            console.error(
              ansi.red(err instanceof Error ? err.message : String(err)),
            );
          }
          output.write("> ");
          continue;
        }
        if (cmd === "lesson") {
          if (!arg) {
            for (const l of listLessons()) {
              const mark = l.id === session.activeLessonId ? "*" : " ";
              console.log(`${mark} ${l.id} — ${l.title} [${l.topics.join(", ")}]`);
            }
            output.write("> ");
            continue;
          }
          const next = getLesson(arg);
          if (!next) {
            console.log(`Unknown lesson: ${arg}`);
            output.write("> ");
            continue;
          }
          lessonId = next.id;
          lesson = next;
          session.setLessonId(lessonId);
          const written = await applyStarterFiles(next, workspaceRoot);
          console.log(`Active lesson: ${next.title} (${next.id})`);
          if (written.length) {
            console.log(`Starter files written: ${written.join(", ")}`);
          }
          output.write("> ");
          continue;
        }

        console.log(`Unknown command: /${cmd}. Try /help.`);
        output.write("> ");
        continue;
      }

      const status = new StatusLine();
      const loop = new TurnLoop({
        session,
        model,
        tools,
        lesson,
        onEvent: (event) => {
          if (event.type === "status") {
            status.start(event.message);
          } else if (event.type === "status_clear") {
            status.stop();
          } else if (event.type === "trace") {
            status.stop();
            printTrace(event.trace);
          }
        },
      });
      try {
        const result = await loop.runTurn(trimmed);
        status.stop();
        const reply = result.reply;
        if (reply.startsWith("(empty NIM response") || reply.startsWith("(empty model")) {
          console.log(ansi.yellow(reply));
        } else {
          console.log(reply);
        }
        console.log();
      } catch (err) {
        status.stop();
        console.error(
          ansi.red(
            `Turn failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        console.log();
      }
      output.write("> ");
    }
  } finally {
    rl.close();
  }
}

function parseModelMode(argv: string[]): ModelMode {
  const idx = argv.indexOf("--model");
  if (idx >= 0 && argv[idx + 1]) {
    const v = argv[idx + 1]!.toLowerCase();
    if (v === "nim") return "nim";
    if (v === "mock") return "mock";
    console.error(`Unknown --model ${argv[idx + 1]}; using mock.`);
  }
  if (argv.includes("--nim")) return "nim";
  return "mock";
}

function parseSessionMode(argv: string[]): SessionOpenMode {
  if (argv.includes("--new")) return { kind: "new" };
  const idx = argv.indexOf("--session");
  if (idx >= 0 && argv[idx + 1]) {
    return { kind: "id", id: argv[idx + 1]! };
  }
  return { kind: "continue" };
}

function createModel(mode: ModelMode, mock: MockClient): ModelClient {
  if (mode === "mock") return mock;

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error(
      "NVIDIA_API_KEY is required for --model nim. Falling back to mock.",
    );
    return mock;
  }
  const modelName =
    process.env.NIM_MODEL?.trim() || "meta/llama-3.1-8b-instruct";
  return new NimClient({ apiKey, model: modelName });
}

function printDoctorReport(report: Awaited<ReturnType<typeof runNimDoctor>>): void {
  const yn = (ok: boolean | null) =>
    ok === null ? ansi.dim("?") : ok ? ansi.green("ok") : ansi.red("fail");
  console.log(ansi.bold("NIM doctor"));
  console.log(`  endpoint   ${report.baseURL}`);
  console.log(`  model      ${report.model}`);
  console.log(`  api key    ${report.keyPresent ? ansi.green("present") : ansi.red("missing")}`);
  console.log(
    `  models.list ${yn(report.modelsListOk)}${
      report.modelsCount != null ? ` (${report.modelsCount} models)` : ""
    }`,
  );
  console.log(
    `  model id   ${
      report.modelListed === null
        ? ansi.dim("n/a")
        : report.modelListed
          ? ansi.green("listed in catalog")
          : ansi.yellow("NOT in /v1/models — check spelling")
    }`,
  );
  console.log(`  chat ping  ${yn(report.chatOk)} — ${report.chatDetail}`);
  console.log(ansi.dim(`  elapsed    ${report.elapsedMs}ms`));
  if (report.modelsListOk && !report.chatOk) {
    console.log(
      ansi.yellow(
        "  Hint: auth + endpoint work; this model’s chat completions are hanging or failing. Try another NIM_MODEL.",
      ),
    );
  }
  console.log();
}

function printTrace(t: ToolTrace): void {
  const arrow = ansi.dim("→");
  const back = ansi.dim("←");
  const status = t.ok ? ansi.green("ok") : ansi.red("err");
  console.log(`${arrow} ${ansi.bold(t.name)} ${ansi.dim(t.argsSummary)}`);
  console.log(`${back} ${status} ${t.resultSummary}`);
  if (t.detail) {
    const body =
      t.detail.startsWith("---") || t.detail.includes("\n--- ")
        ? colorizeUnifiedDiff(t.detail)
        : t.detail;
    console.log(body);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
