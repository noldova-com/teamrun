/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";

import ProcessRunner from "../../processes/process-runner.ts";
import ProcessException from "../../processes/process.exception.ts";

class ProcessRunnerTests {
  private static readonly TIMEOUT: number = 10_000;

  public static register(): void {
    test("capturing returns the exit code and both output streams in the requested directory", async () => {
      const result = await new ProcessRunner().captureAsync(
        process.execPath,
        ["-e", "process.stdout.write(process.cwd()); process.stderr.write('warning'); process.exitCode = 3"],
        tmpdir(),
        ProcessRunnerTests.TIMEOUT);

      assert.equal(result.exitCode, 3);
      assert.equal(realpathSync(result.output), realpathSync(tmpdir()));
      assert.equal(result.errorOutput, "warning");
    });

    test("capturing stops a process that outlives its deadline", async () => {
      const started = Date.now();

      await assert.rejects(
        new ProcessRunner().captureAsync(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], tmpdir(), 300),
        new ProcessException(`"${process.execPath}" did not finish within 300 ms.`));
      assert.ok(Date.now() - started < 5_000);
    });

    test("capturing stops a process whose output exceeds the limit", async () => {
      await assert.rejects(
        new ProcessRunner().captureAsync(process.execPath, ["-e", "process.stdout.write('x'.repeat(17 * 1024 * 1024)); setTimeout(() => {}, 20000)"], tmpdir(),
          ProcessRunnerTests.TIMEOUT),
        new ProcessException(`"${process.execPath}" wrote more than ${16 * 1024 * 1024} bytes.`));
    });

    test("capturing and running report a command that cannot start, keeping the cause", async () => {
      const isStartFailure = (t: unknown): boolean =>
        t instanceof ProcessException && t.message === "\"teamrun-missing-command\" could not start." && t.cause instanceof Error;

      await assert.rejects(new ProcessRunner().captureAsync("teamrun-missing-command", [], tmpdir(), ProcessRunnerTests.TIMEOUT), isStartFailure);
      await assert.rejects(new ProcessRunner().runAsync("teamrun-missing-command", [], tmpdir()), isStartFailure);
    });

    test("running shares the output streams and returns the exit code", async () => {
      assert.equal(await new ProcessRunner().runAsync(process.execPath, ["-e", "process.exitCode = 4"], tmpdir()), 4);
      assert.equal(await new ProcessRunner().runAsync(process.execPath, ["-e", ""], tmpdir()), 0);
    });
  }
}

ProcessRunnerTests.register();
