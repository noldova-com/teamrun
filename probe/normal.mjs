/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const from = "PRAGMA journal_mode = WAL";
const to = "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL";
const changed = [];
function walk(folder) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory())
      walk(path);
    else if (name.endsWith(".js")) {
      const text = readFileSync(path, "utf8");
      if (text.includes(from) && !text.includes(to)) {
        writeFileSync(path, text.split(from).join(to));
        changed.push(path);
      }
    }
  }
}
walk(join(process.cwd(), "node_modules", "@noldova", "context.data.sql.sqlite"));
process.stdout.write(`PROBE-NORMAL changed ${changed.length}: ${changed.join(", ")}` + String.fromCharCode(10));
if (changed.length === 0)
  process.exit(1);
