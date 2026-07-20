/**
 * In-place status / spinner for long NIM waits.
 * See: docs/TURN_LOOP.md (Events for the CLI)
 */

import { ansi } from "./ansi.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Writes a single updating status line to stderr (keeps stdout clean for diffs).
 * No-TTY: prints a one-shot start message; no animation.
 */
export class StatusLine {
  private timer: NodeJS.Timeout | undefined;
  private frame = 0;
  private startedAt = 0;
  private text = "";
  private active = false;

  start(text: string): void {
    this.text = text;
    this.startedAt = Date.now();
    this.frame = 0;

    if (!process.stderr.isTTY && process.env.FORCE_COLOR == null) {
      if (!this.active) {
        process.stderr.write(`${ansi.dim("…")} ${text}\n`);
      }
      this.active = true;
      return;
    }

    this.active = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.render(), 80);
    this.render();
  }

  update(text: string): void {
    this.text = text;
    if (this.active && (process.stderr.isTTY || process.env.FORCE_COLOR)) {
      this.render();
    }
  }

  /** Clear the spinner line. Optionally print a final one-line note. */
  stop(final?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.active && (process.stderr.isTTY || process.env.FORCE_COLOR)) {
      process.stderr.write("\r\x1b[K");
    }
    this.active = false;
    if (final) {
      process.stderr.write(`${final}\n`);
    }
  }

  private render(): void {
    const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1);
    const spin = ansi.cyan(FRAMES[this.frame % FRAMES.length]!);
    this.frame += 1;
    const line = `${spin} ${this.text}  ${ansi.dim(`${elapsed}s`)}`;
    process.stderr.write(`\r\x1b[K${line}`);
  }
}
