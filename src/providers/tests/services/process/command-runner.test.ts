/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CommandRunner, ProcessCommand, ProcessTerminator } from "@noldova/teamrun-providers";

@TestClass
export class CommandRunnerTests {
  private static readonly runner: CommandRunner = new CommandRunner(new ProcessTerminator(process.platform));

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
  public async terminatesACommandThatExceedsTheTimeout(): Promise<void> {
    const command = new ProcessCommand(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);

    const result = await CommandRunnerTests.runner.run(command, process.env, 100);

    Assert.isTrue(result.timedOut);
    Assert.isFalse(result.succeeded);
  }

  @TestMethod
  public async rejectsAMissingExecutableAndAnInvalidTimeout(): Promise<void> {
    const command = new ProcessCommand("teamrun-no-such-executable", []);

    await Assert.throwsAsync(() => CommandRunnerTests.runner.run(command, process.env, 1000), Error);
    Assert.throws(() => CommandRunnerTests.runner.run(command, process.env, 0), ArgumentOutOfRangeException);
  }
}
