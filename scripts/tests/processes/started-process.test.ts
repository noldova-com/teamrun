/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { ChildProcess, spawn } from "node:child_process";
import { test } from "node:test";

import ProcessException from "../../processes/process.exception.ts";
import StartedProcess from "../../processes/started-process.ts";

class StartedProcessTests {
  private static readonly TIMEOUT: number = 10_000;
  private static readonly SHORT_WAIT: number = 100;
  private static readonly WAITING: string = "setInterval(() => {}, 1000)";

  public static register(): void {
    test("a process that ends is reported as exited with its exit code", async () => {
      const child = spawn(process.execPath, ["-e", "process.exitCode = 7"], { stdio: "ignore" });
      const started = new StartedProcess(child);

      assert.equal(started.id, child.pid);
      assert.equal(await started.waitAsync(StartedProcessTests.TIMEOUT), true);
      assert.deepEqual([started.hasExited, started.exitCode], [true, 7]);
    });

    test("waiting for a process that goes on running ends at the deadline, and a signal then stops it", async () => {
      const started = new StartedProcess(spawn(process.execPath, ["-e", StartedProcessTests.WAITING], { stdio: "ignore" }));

      assert.equal(await started.waitAsync(StartedProcessTests.SHORT_WAIT), false);
      assert.deepEqual([started.hasExited, started.exitCode], [false, null]);

      started.signal("SIGKILL");

      assert.equal(await started.waitAsync(StartedProcessTests.TIMEOUT), true);
      assert.deepEqual([started.hasExited, started.exitCode], [true, null]);
    });

    test("a process that never started has no process ID and says so", () => {
      assert.throws(() => new StartedProcess(new ChildProcess()).id, new ProcessException("The process has no process ID, because it never started."));
    });
  }
}

StartedProcessTests.register();
