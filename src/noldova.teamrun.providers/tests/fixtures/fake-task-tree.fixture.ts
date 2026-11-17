/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type FakeTaskTreeMode = "follow" | "sequence" | "stay";

export class FakeTaskTree {
  public static start(pidFile: string, depth: number, mode: FakeTaskTreeMode = "follow", outlivesOnWindows: boolean = false): ChildProcess {
    return spawn(process.execPath, [fileURLToPath(import.meta.url), pidFile, String(depth), mode],
      { cwd: fileURLToPath(new URL(".", import.meta.url)), stdio: "ignore", detached: outlivesOnWindows && process.platform === "win32" });
  }

  public static read(pidFile: string): number[] {
    return existsSync(pidFile) ? readFileSync(pidFile, "utf8").trim().split("\n").filter(t => t.length !== 0).map(Number) : [];
  }

  public static runs(processId: number): boolean {
    if (process.platform !== "win32")
      return !["", "Z"].includes(spawnSync("ps", ["-o", "stat=", "-p", String(processId)], { encoding: "utf8" }).stdout.trim().slice(0, 1));
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  public static endAll(pidFile: string): void {
    for (const processId of FakeTaskTree.read(pidFile))
      try {
        process.kill(processId, "SIGKILL");
      }
      catch {
        continue;
      }
  }

  public static run(pidFile: string, depth: number, mode: FakeTaskTreeMode): void {
    appendFileSync(pidFile, `${process.pid}\n`);
    if (mode === "sequence") {
      FakeTaskTree.start(pidFile, 1, "stay").once("exit", () => FakeTaskTree.start(pidFile, 1, "stay"));
      setInterval(() => undefined, 1000);
      return;
    }
    if (mode === "stay") {
      process.on("SIGTERM", () => undefined);
      setInterval(() => undefined, 1000);
      return;
    }
    if (depth > 1)
      FakeTaskTree.start(pidFile, depth - 1);
    const parent = process.ppid;
    setInterval(() => {
      try {
        process.kill(parent, 0);
      }
      catch {
        process.exit(0);
      }
    }, 100);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  FakeTaskTree.run(process.argv[2]!, Number(process.argv[3]), process.argv[4] as FakeTaskTreeMode);
