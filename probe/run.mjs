/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, appendFileSync, writeFileSync, openSync, writeSync, fsyncSync, closeSync, unlinkSync } from "node:fs";
import { cpus, freemem, tmpdir } from "node:os";
import { join } from "node:path";

const folder = join(process.cwd(), "_build", "probe");
mkdirSync(folder, { recursive: true });
const log = join(folder, `samples-${process.platform}-${process.arch}.log`);
writeFileSync(log, `start ${new Date().toISOString()} cpus=${cpus().length} cwd=${process.cwd()} tmp=${tmpdir()}\n`);
const windows = process.platform === "win32";
const listScript = "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.CreationDate } | Out-Null";

function timed(command, args) {
  const start = performance.now();
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    const limit = setTimeout(() => { child.kill(); resolve(-1); }, 60_000);
    child.on("exit", () => { clearTimeout(limit); resolve(Math.round(performance.now() - start)); });
    child.on("error", () => { clearTimeout(limit); resolve(-2); });
  });
}

function diskWrite(path) {
  const start = performance.now();
  const file = join(path, `probe-io-${process.pid}.bin`);
  const block = Buffer.alloc(1 << 20, 7);
  const fd = openSync(file, "w");
  for (let i = 0; i < 4; i++) writeSync(fd, block);
  fsyncSync(fd);
  closeSync(fd);
  unlinkSync(file);
  return Math.round(performance.now() - start);
}

let session;
let pending;
let buffer = "";
function startSession() {
  session = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "-"], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
  session.stdout.setEncoding("utf8");
  session.stdout.on("data", text => {
    buffer += text;
    const match = /CIM ([0-9.,]+)/.exec(buffer);
    if (match && pending) { buffer = ""; const done = pending; pending = undefined; done(Math.round(Number(match[1].replace(",", ".")))); }
  });
}
function sessionCim() {
  return new Promise(resolve => {
    const limit = setTimeout(() => { pending = undefined; resolve(-1); }, 60_000);
    pending = value => { clearTimeout(limit); resolve(value); };
    session.stdin.write("$t=(Measure-Command { " + listScript + " }).TotalMilliseconds; Write-Output \"CIM $t\"\n");
  });
}

function busy(previous) {
  const now = cpus().map(cpu => cpu.times);
  const sum = times => times.user + times.nice + times.sys + times.irq;
  let used = 0;
  let total = 0;
  now.forEach((times, index) => {
    const before = previous[index];
    const all = times => sum(times) + times.idle;
    used += sum(times) - sum(before);
    total += all(times) - all(before);
  });
  return { now, percent: total > 0 ? Math.round(100 * used / total) : 0 };
}

let stopped = false;
async function sample() {
  if (windows) startSession();
  let previous = cpus().map(cpu => cpu.times);
  while (!stopped) {
    const at = new Date().toISOString();
    const nodeSpawn = await timed(process.execPath, ["-e", "0"]);
    const psExit = windows ? await timed("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "exit"]) : 0;
    const psList = windows ? await timed("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", listScript]) : 0;
    const cim = windows ? await sessionCim() : 0;
    const cwdDisk = diskWrite(folder);
    const tmpDisk = diskWrite(tmpdir());
    const processes = windows ? Number((spawnSync("tasklist", ["/nh"], { encoding: "utf8" }).stdout ?? "").split("\n").filter(Boolean).length) : 0;
    const load = busy(previous);
    previous = load.now;
    appendFileSync(log, `${at} cpu=${load.percent}% freeMB=${Math.round(freemem() / 1048576)} procs=${processes} node=${nodeSpawn} psExit=${psExit} psList=${psList} sessionCim=${cim} diskCwd=${cwdDisk} diskTmp=${tmpDisk}\n`);
    await new Promise(resolve => setTimeout(resolve, 3_000));
  }
}

const sampling = sample();
const test = spawn(process.execPath, ["scripts/test.ts", ...process.argv.slice(2)], { stdio: "inherit" });
test.on("exit", async code => {
  stopped = true;
  await sampling;
  session?.stdin.end();
  appendFileSync(log, `end ${new Date().toISOString()} code=${code}\n`);
  process.stdout.write("PROBE-SAMPLES" + String.fromCharCode(10) + readFileSync(log, "utf8"));
  process.exit(code ?? 1);
});
