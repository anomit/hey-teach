/**
 * Tiny ANSI helpers for CLI chrome (diffs, banner). Respects NO_COLOR / non-TTY.
 * See: docs/TURN_LOOP.md (Events for the CLI)
 */

function colorsEnabled(): boolean {
  if (process.env.FORCE_COLOR === "0") return false;
  if (process.env.FORCE_COLOR != null && process.env.FORCE_COLOR !== "") {
    return true;
  }
  if (process.env.NO_COLOR != null) return false;
  return Boolean(process.stdout.isTTY);
}

const enabled = colorsEnabled();

function wrap(codes: number | number[], s: string): string {
  if (!enabled) return s;
  const seq = Array.isArray(codes) ? codes.join(";") : String(codes);
  return `\x1b[${seq}m${s}\x1b[0m`;
}

export const ansi = {
  enabled,
  dim: (s: string) => wrap(2, s),
  bold: (s: string) => wrap(1, s),
  red: (s: string) => wrap(31, s),
  green: (s: string) => wrap(32, s),
  yellow: (s: string) => wrap(33, s),
  cyan: (s: string) => wrap(36, s),
  magenta: (s: string) => wrap(35, s),
};

/** Color a unified-diff body line-by-line. */
export function colorizeUnifiedDiff(diff: string): string {
  return diff
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return wrap([1, 2], line);
      }
      if (line.startsWith("@@")) {
        return ansi.cyan(line);
      }
      if (line.startsWith("+")) {
        return ansi.green(line);
      }
      if (line.startsWith("-")) {
        return ansi.red(line);
      }
      return ansi.dim(line);
    })
    .join("\n");
}
