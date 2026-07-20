/**
 * Line-oriented unified diffs for tool traces (familiar +/- hunks).
 * See: docs/ARCHITECTURE.md (Tools), docs/TURN_LOOP.md
 */

/** Split into lines without dropping a trailing empty line from a final \n. */
function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();
  return lines;
}

/**
 * Build a unified diff for `path`.
 * New files use `--- /dev/null`; otherwise `--- a/` / `+++ b/`.
 */
export function unifiedDiff(
  path: string,
  before: string,
  after: string,
  context = 3,
): string {
  const a = splitLines(before);
  const b = splitLines(after);

  if (before === after) {
    return [`--- a/${path}`, `+++ b/${path}`, "@@ unchanged @@"].join("\n");
  }

  const edits = myersDiff(a, b);
  const hunks = buildHunks(edits, context);

  const header =
    before === ""
      ? [`--- /dev/null`, `+++ b/${path}`]
      : [`--- a/${path}`, `+++ b/${path}`];

  if (hunks.length === 0) {
    return [...header, "@@ unchanged @@"].join("\n");
  }

  const body: string[] = [];
  for (const h of hunks) {
    body.push(
      `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`,
    );
    body.push(...h.lines);
  }
  return [...header, ...body].join("\n");
}

type Edit =
  | { type: "equal"; line: string }
  | { type: "delete"; line: string }
  | { type: "insert"; line: string };

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

/** Myers O(ND) line diff → flat edit script. */
function myersDiff(a: string[], b: string[]): Edit[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];

  const offset = max;
  const v = new Int32Array(2 * max + 1);
  v.fill(-1);
  v[offset + 1] = 0;

  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    const vSnap = Int32Array.from(v);
    trace.push(vSnap);

    for (let k = -d; k <= d; k += 2) {
      const kIndex = offset + k;
      let x: number;
      if (k === -d || (k !== d && v[kIndex - 1] < v[kIndex + 1])) {
        x = v[kIndex + 1];
      } else {
        x = v[kIndex - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[kIndex] = x;
      if (x >= n && y >= m) {
        return backtrack(a, b, trace, offset);
      }
    }
  }
  return [];
}

function backtrack(
  a: string[],
  b: string[],
  trace: Int32Array[],
  offset: number,
): Edit[] {
  const edits: Edit[] = [];
  let x = a.length;
  let y = b.length;

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = v[offset + prevK]!;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      edits.push({ type: "equal", line: a[x - 1]! });
      x--;
      y--;
    }
    if (d === 0) break;
    if (x > prevX) {
      edits.push({ type: "delete", line: a[x - 1]! });
      x = prevX;
    } else if (y > prevY) {
      edits.push({ type: "insert", line: b[y - 1]! });
      y = prevY;
    }
  }

  edits.reverse();
  return edits;
}

function buildHunks(edits: Edit[], context: number): Hunk[] {
  // Mark change indices
  const changeAt: boolean[] = edits.map((e) => e.type !== "equal");
  if (!changeAt.some(Boolean)) return [];

  const include = new Array<boolean>(edits.length).fill(false);
  for (let i = 0; i < edits.length; i++) {
    if (!changeAt[i]) continue;
    for (
      let j = Math.max(0, i - context);
      j <= Math.min(edits.length - 1, i + context);
      j++
    ) {
      include[j] = true;
    }
  }

  const hunks: Hunk[] = [];
  let i = 0;
  while (i < edits.length) {
    if (!include[i]) {
      i++;
      continue;
    }
    const start = i;
    while (i < edits.length && include[i]) i++;
    const slice = edits.slice(start, i);

    let oldStart = 1;
    let newStart = 1;
    for (let j = 0; j < start; j++) {
      const e = edits[j]!;
      if (e.type === "equal" || e.type === "delete") oldStart++;
      if (e.type === "equal" || e.type === "insert") newStart++;
    }

    let oldCount = 0;
    let newCount = 0;
    const lines: string[] = [];
    for (const e of slice) {
      if (e.type === "equal") {
        lines.push(` ${e.line}`);
        oldCount++;
        newCount++;
      } else if (e.type === "delete") {
        lines.push(`-${e.line}`);
        oldCount++;
      } else {
        lines.push(`+${e.line}`);
        newCount++;
      }
    }

    // Unified diff uses 0-length starts as 0 when count is 0
    hunks.push({
      oldStart: oldCount === 0 ? 0 : oldStart,
      oldCount,
      newStart: newCount === 0 ? 0 : newStart,
      newCount,
      lines,
    });
  }
  return hunks;
}
