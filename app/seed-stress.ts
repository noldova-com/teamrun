/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { StressChatCommand } from "@noldova/teamrun.runtime/development";

process.exitCode = await new StressChatCommand(path.dirname(fileURLToPath(import.meta.url)), process.env, homedir(), process.stdout).runAsync(process.argv.slice(2));
