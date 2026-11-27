/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const folder = join(process.cwd(), "_build", "probe");
mkdirSync(folder, { recursive: true });
const file = join(folder, `windows-${Date.now()}.log`);
const test = spawn(process.execPath, ["scripts/test.ts", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, TEAMRUN_PROBE_WINDOWS: file } });
test.on("exit", code => process.exit(code ?? 1));
