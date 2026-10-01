/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { SystemCommand, SystemCommandException } from "@noldova/teamrun-shell-runtime";

@TestClass
export class SystemCommandTests {
  @TestMethod
  public async returnsTheStandardOutputWithoutAShell(): Promise<void> {
    const output = await new SystemCommand().runAsync(process.execPath, ["-e", "process.stdout.write(process.argv[1])", "a & b | c"]);

    Assert.areEqual("a & b | c", output);
  }

  @TestMethod
  public async reportsANonzeroExitWithTheProgramsError(): Promise<void> {
    const exception = await Assert.throwsAsync(
      () => new SystemCommand().runAsync(process.execPath, ["-e", "process.stderr.write(\"denied\"); process.exitCode = 5"]),
      SystemCommandException);

    Assert.isTrue(exception.message.startsWith(`${process.execPath} failed: `));
    Assert.isTrue(exception.message.includes("denied"));
    Assert.isInstanceOf(exception.cause, Error);
  }

  @TestMethod
  public async reportsAProgramThatCannotStart(): Promise<void> {
    await Assert.throwsAsync(() => new SystemCommand().runAsync("teamrun-missing-program", []), SystemCommandException);
  }
}
