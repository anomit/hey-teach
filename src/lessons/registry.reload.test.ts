import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLesson,
  isLessonPlugin,
  reloadLessonPlugins,
} from "./registry.js";

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

afterEach(async () => {
  await reloadLessonPlugins(repoRoot);
});

describe("isLessonPlugin", () => {
  it("accepts a full plugin shape", () => {
    expect(
      isLessonPlugin({
        id: "x",
        title: "X",
        topics: ["t"],
        systemPromptAddon: "hi",
      }),
    ).toBe(true);
  });

  it("rejects unrelated exports", () => {
    expect(isLessonPlugin({ id: "x" })).toBe(false);
    expect(isLessonPlugin("stub-bfs")).toBe(false);
  });
});

describe("reloadLessonPlugins", () => {
  it("picks up a new plugin file that was not in the process at start", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "hey-teach-lessons-"));
    const dir = path.join(root, "src", "lessons");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "stub-extra.ts"),
      `export const stubExtraLesson = {
  id: "stub-extra",
  title: "Extra",
  topics: ["graphs"],
  systemPromptAddon: "extra",
};
`,
    );
    const result = await reloadLessonPlugins(root);
    expect(result.ids).toContain("stub-extra");
    expect(result.added).toContain("stub-extra");
    expect(getLesson("stub-extra")?.title).toBe("Extra");
    fs.rmSync(root, { recursive: true, force: true });
  });
});
