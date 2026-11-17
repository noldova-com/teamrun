/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { SharedMcpLauncher } from "./shared-mcp-launcher.js";

await new SharedMcpLauncher(process.platform, process.env, process.execPath, fileURLToPath(import.meta.url)).runAsync(import.meta.main, process.argv.slice(2));
