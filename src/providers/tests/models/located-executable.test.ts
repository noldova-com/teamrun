/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ExecutableSource, LocatedExecutable } from "@noldova/teamrun-providers";

@TestClass
export class LocatedExecutableTests {
  @TestMethod
  public becomesACommandWithoutArguments(): void {
    const executable = new LocatedExecutable("C:/tools/codex.exe", ExecutableSource.GlobalNpm);

    const command = executable.toCommand();

    Assert.areEqual("C:/tools/codex.exe", command.executable);
    Assert.areEqual(0, command.arguments.length);
    Assert.areEqual(ExecutableSource.GlobalNpm, executable.source);
    Assert.areEqual("path", Assert.throws(() => new LocatedExecutable("", ExecutableSource.Path), ArgumentException).parameterName);
  }
}
