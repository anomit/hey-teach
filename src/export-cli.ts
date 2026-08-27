/**
 * Headless trajectory export: npm run export -- --all
 * See: docs/EXPORT.md
 */

import "dotenv/config";
import { exportTrajectories } from "./export/trajectories.js";
import { isOutcome } from "./session-outcome.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const workspaceRoot = process.cwd();

  let filter = "all";
  let outPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--all") filter = "all";
    else if (a === "--outcome" && argv[i + 1]) {
      filter = argv[++i]!;
      if (!isOutcome(filter) && filter !== "all") {
        console.error(`Unknown outcome filter: ${filter}`);
        process.exit(1);
      }
    } else if (a === "--out" && argv[i + 1]) {
      outPath = argv[++i];
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: npm run export -- [--all] [--outcome green|red|…] [--out path]`);
      process.exit(0);
    }
  }

  const result = await exportTrajectories({
    workspaceRoot,
    filter,
    outPath,
  });
  console.log(`Exported ${result.count} session(s) → ${result.path}`);
  console.log(`Outcomes: ${JSON.stringify(result.outcomes)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
