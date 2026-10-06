/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import ProcessRunner from "../../processes/process-runner.ts";
import ProcessTimeoutException from "../../processes/process-timeout.exception.ts";
import ProcessException from "../../processes/process.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

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

    test("requiring a command passes when it succeeds and otherwise fails naming the command, its arguments, its exit code and its output", async () => {
      const runner = new ProcessRunner();
      const script = "process.stdout.write('out '); process.stderr.write(process.env.TEAMRUN_FIXTURE_VALUE ?? 'none'); process.exitCode = Number(process.argv[1])";

      await runner.requireAsync(process.execPath, ["-e", script, "0"], tmpdir(), ProcessRunnerTests.TIMEOUT);
      await assert.rejects(runner.requireAsync(process.execPath, ["-e", script, "5"], tmpdir(), ProcessRunnerTests.TIMEOUT, { ...process.env, TEAMRUN_FIXTURE_VALUE: "given" }),
        new ProcessException(`${path.basename(process.execPath)} -e ${script} 5 failed with exit code 5:\nout given`));
    });

    test("capturing stops a process that outlives its deadline", async () => {
      const started = Date.now();

      await assert.rejects(
        new ProcessRunner().captureAsync(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], tmpdir(), 300),
        new ProcessTimeoutException(`"${process.execPath}" did not finish within 300 ms.`));
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
      await assert.rejects(
        new ProcessRunner().runLoggedAsync("teamrun-missing-command", [], tmpdir(), path.join(tmpdir(), "teamrun-missing-command.log"), new TextOutputFixture(), new TextOutputFixture()),
        isStartFailure);
    });

    test("running shares the output streams and returns the exit code", async () => {
      assert.equal(await new ProcessRunner().runAsync(process.execPath, ["-e", "process.exitCode = 4"], tmpdir()), 4);
      assert.equal(await new ProcessRunner().runAsync(process.execPath, ["-e", ""], tmpdir()), 0);
    });

    test("running with a log passes both output streams on, keeps them both in the log and returns the exit code", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const log = path.join(repository.directory, "run.log");
      const output = new TextOutputFixture();
      const errorOutput = new TextOutputFixture();
      const script = "process.stdout.write('passed'); process.stderr.write('failed'); process.exitCode = 5";

      const exitCode = await new ProcessRunner().runLoggedAsync(process.execPath, ["-e", script], tmpdir(), log, output, errorOutput);

      assert.deepEqual([exitCode, output.text, errorOutput.text], [5, "passed", "failed"]);
      assert.ok(["passedfailed", "failedpassed"].includes(await readFile(log, "utf8")));
    });

    test("running passes the given environment instead of the process's own", async () => {
      const script = "process.exitCode = process.env.TEAMRUN_FIXTURE_VALUE === \"given\" ? 0 : 3";

      assert.equal(await new ProcessRunner().runAsync(process.execPath, ["-e", script], tmpdir(), { ...process.env, TEAMRUN_FIXTURE_VALUE: "given" }), 0);
      assert.equal(await new ProcessRunner().runAsync(process.execPath, ["-e", script], tmpdir()), 3);
      assert.equal((await new ProcessRunner().captureAsync(process.execPath, ["-e", script], tmpdir(), ProcessRunnerTests.TIMEOUT, { ...process.env, TEAMRUN_FIXTURE_VALUE: "given" })).exitCode, 0);
      assert.equal((await new ProcessRunner().captureAsync(process.execPath, ["-e", script], tmpdir(), ProcessRunnerTests.TIMEOUT)).exitCode, 3);
    });

    test("starting returns the running process at once, with both output streams going to the log", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const log = path.join(repository.directory, "started.log");
      const script = "process.stdout.write('passed'); process.stderr.write('failed'); process.exitCode = 6";

      const started = await new ProcessRunner().startAsync(process.execPath, ["-e", script], tmpdir(), log);

      assert.ok(started.id > 0);
      assert.equal(await started.waitAsync(ProcessRunnerTests.TIMEOUT), true);
      assert.equal(started.exitCode, 6);
      assert.ok(["passedfailed", "failedpassed"].includes(await readFile(log, "utf8")));
    });

    test("starting reports a command that cannot start, keeping the cause", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      await assert.rejects(new ProcessRunner().startAsync("teamrun-missing-command", [], tmpdir(), path.join(repository.directory, "missing.log")),
        (error: unknown) => error instanceof ProcessException && error.message === "\"teamrun-missing-command\" could not start." && error.cause instanceof Error);
    });

    test("a process is running until it has exited, and a process ID that is not a number is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runner = new ProcessRunner();
      const started = await runner.startAsync(process.execPath, ["-e", ""], tmpdir(), path.join(repository.directory, "ended.log"));
      await started.waitAsync(ProcessRunnerTests.TIMEOUT);

      assert.equal(runner.isRunning(process.pid), true);
      assert.equal(runner.isRunning(started.id), false);
      assert.throws(() => runner.isRunning(Number.NaN), TypeError);
    });

    test("killing ends a running process, a process that has already ended is left alone, and a process ID that is not a number is refused", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runner = new ProcessRunner();
      const started = await runner.startAsync(process.execPath, ["-e", "setInterval(() => {}, 1000)"], tmpdir(), path.join(repository.directory, "killed.log"));
      t.after(() => {
        if (!started.hasExited)
          started.signal("SIGKILL");
      });

      runner.kill(started.id);

      assert.equal(await started.waitAsync(ProcessRunnerTests.TIMEOUT), true);
      assert.equal(runner.isRunning(started.id), false);
      runner.kill(started.id);
      assert.throws(() => runner.kill(Number.NaN), TypeError);
    });
  }
}

ProcessRunnerTests.register();
