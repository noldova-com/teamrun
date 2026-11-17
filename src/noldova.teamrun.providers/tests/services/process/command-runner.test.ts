/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRunner, NodeProcessStarter, ProcessCommand, ProcessTerminator } from "@noldova/teamrun.providers";

@TestClass
export class CommandRunnerTests {
  private static readonly runner: CommandRunner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));

  @TestMethod
  public async capturesOutputAndExitCode(): Promise<void> {
    const command = new ProcessCommand(process.execPath, ["-e", "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)"]);

    const result = await CommandRunnerTests.runner.run(command, process.env, 10_000);

    Assert.areEqual(3, result.exitCode);
    Assert.areEqual("out", result.stdout);
    Assert.areEqual("err", result.stderr);
    Assert.isFalse(result.timedOut);
  }

  @TestMethod
  public async keepsEachOutputUpToItsCapOf512KOrTheOneItIsGiven(): Promise<void> {
    const command = new ProcessCommand(process.execPath, ["-e", "process.stdout.write('o'.repeat(600 * 1024)); process.stderr.write('e'.repeat(600 * 1024))"]);
    const raised = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)), 1024 * 1024);

    const capped = await CommandRunnerTests.runner.run(command, process.env, 10_000);
    const whole = await raised.run(command, process.env, 10_000);

    Assert.areEqual(JSON.stringify([512 * 1024, 512 * 1024, 600 * 1024, 600 * 1024, true]),
      JSON.stringify([capped.stdout.length, capped.stderr.length, whole.stdout.length, whole.stderr.length, whole.succeeded]));
  }

  @TestMethod
  public async runsAProgramThatClosesItsInputBeforeTheRunnerEndsIt(): Promise<void> {
    const command = new ProcessCommand(process.execPath, ["-e", "process.stdin.destroy(); process.stdout.write('closed')"]);

    const result = await CommandRunnerTests.runner.run(command, process.env, 10_000);

    Assert.areEqual(JSON.stringify([0, "closed"]), JSON.stringify([result.exitCode, result.stdout]));
  }

  @TestMethod
  public async terminatesACommandThatExceedsTheTimeout(): Promise<void> {
    const command = new ProcessCommand(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);

    const result = await CommandRunnerTests.runner.run(command, process.env, 100);

    Assert.isTrue(result.timedOut);
    Assert.isFalse(result.succeeded);
  }

  @TestMethod
  public async letsACommandWithNoTimeLimitRunToItsEnd(): Promise<void> {
    const command = new ProcessCommand(process.execPath, ["-e", "setTimeout(() => process.stdout.write('done'), 300)"]);

    const result = await CommandRunnerTests.runner.run(command, process.env, null);

    Assert.areEqual("done", result.stdout);
    Assert.isTrue(result.succeeded);
    Assert.isFalse(result.timedOut);
  }

  @TestMethod
  public async stopsACommandWhenCancelledAndOneCancelledBeforeItRuns(): Promise<void> {
    const command = new ProcessCommand(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);
    const controller = new AbortController();
    const cancelled = new AbortController();
    cancelled.abort();

    const running = CommandRunnerTests.runner.run(command, process.env, 60_000, controller.signal);
    controller.abort();
    const results = await Promise.all([running, CommandRunnerTests.runner.run(command, process.env, 60_000, cancelled.signal)]);

    Assert.isTrue(results.every(t => !t.succeeded && !t.timedOut));
  }

  @TestMethod
  public async rejectsAMissingExecutableAndAnInvalidTimeout(): Promise<void> {
    const command = new ProcessCommand("teamrun-no-such-executable", []);

    await Assert.throwsAsync(() => CommandRunnerTests.runner.run(command, process.env, 1000), Error);
    Assert.throws(() => CommandRunnerTests.runner.run(command, process.env, 0), ArgumentOutOfRangeException);
  }
}
