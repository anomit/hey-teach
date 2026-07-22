/**
 * Startup banner for Hey Teach.
 * See: README.md
 */

import { ansi } from "./ansi.js";

/** Standard FIGlet-style wordmark (monospace). */
const WORDMARK = [
  " _   _              _____               _",
  "| | | | ___ _   _  |_   _|__  __ _  ___| |__",
  "| |_| |/ _ \\ | | |   | |/ _ \\/ _` |/ __| '_ \\",
  "|  _  |  __/ |_| |   | |  __/ (_| | (__| | | |",
  "|_| |_|\\___|\\__, |   |_|\\___|\\__,_|\\___|_| |_|",
  "            |___/",
].join("\n");

const TAGLINE =
  "Proto-framework to learn about harnesses and other AI meta for programmers";

export function printBanner(meta: {
  mode: string;
  lessonId: string;
  workspaceRoot: string;
  folder: string;
  sessionId?: string;
  sessionNote?: string;
}): void {
  for (const line of WORDMARK.split("\n")) {
    console.log(ansi.cyan(line));
  }
  console.log();
  console.log(`  ${ansi.dim(TAGLINE)}`);
  console.log();
  console.log(`  ${ansi.dim("workspace")}  ${meta.workspaceRoot}`);
  console.log(
    `  ${ansi.dim("model")}      ${meta.mode}    ${ansi.dim("lesson")}  ${meta.lessonId}`,
  );
  console.log(`  ${ansi.dim("folder")}     ${meta.folder}`);
  if (meta.sessionId) {
    const note = meta.sessionNote ? `  ${ansi.dim(meta.sessionNote)}` : "";
    console.log(`  ${ansi.dim("session")}    ${meta.sessionId}${note}`);
  }
  console.log();
  console.log(
    `  ${ansi.dim("Type /help for commands. Enter a message to run a turn.")}\n`,
  );
}
