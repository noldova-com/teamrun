/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, openSync, writeSync, fsyncSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const out = [];
const say = line => { out.push(line); process.stdout.write(line + String.fromCharCode(10)); };
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function flush(folder) {
  const file = join(folder, "flush.bin");
  const fd = openSync(file, "w");
  const times = [];
  for (let i = 0; i < 50; i++) {
    writeSync(fd, Buffer.from("x"));
    const start = performance.now();
    fsyncSync(fd);
    times.push(performance.now() - start);
  }
  closeSync(fd);
  return times;
}

function commits(folder, synchronous, round) {
  const db = new DatabaseSync(join(folder, `c-${synchronous}-${round}.db`));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`PRAGMA synchronous = ${synchronous}`);
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
  const insert = db.prepare("INSERT INTO t (v) VALUES (?)");
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    db.exec("BEGIN");
    insert.run("value " + i);
    db.exec("COMMIT");
  }
  const total = performance.now() - start;
  db.close();
  return total;
}

const folders = { cwd: mkdtempSync(join(process.cwd(), "probe-db-")), tmp: mkdtempSync(join(tmpdir(), "probe-db-")) };
say(`PROBE-DB ${process.platform}-${process.arch} cwd=${folders.cwd} tmp=${folders.tmp}`);
for (const round of [1, 2, 3]) {
  for (const [name, folder] of Object.entries(folders)) {
    const times = flush(folder);
    say(`round ${round} ${name} fsync of 1 byte: median ${median(times).toFixed(2)} ms, max ${Math.max(...times).toFixed(2)} ms, total ${times.reduce((a, b) => a + b, 0).toFixed(0)} ms for 50`);
    for (const synchronous of ["FULL", "NORMAL", "OFF"])
      say(`round ${round} ${name} 100 WAL commits, synchronous ${synchronous}: ${commits(folder, synchronous, round).toFixed(0)} ms`);
  }
}
const test = spawnSync(process.execPath, ["scripts/test.ts", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(test.status ?? 1);
