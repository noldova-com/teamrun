import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
const probe = pathToFileURL(path.resolve("scripts/probe/active.mjs")).href;
const result = spawnSync(process.execPath, ["scripts/test.ts", "angular", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, NODE_OPTIONS: `--import=${probe}` } });
process.exit(result.status ?? 1);
