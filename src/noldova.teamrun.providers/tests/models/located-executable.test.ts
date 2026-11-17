/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ExecutableSource, LocatedExecutable } from "@noldova/teamrun.providers";

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

  @TestMethod
  public becomesACommandWithItsStartingArguments(): void {
    const args = ["C:/npm/node_modules/agent/bin/agent.js"];
    const executable = new LocatedExecutable("C:/npm/node.exe", ExecutableSource.GlobalNpm, args);
    args.push("changed");

    const command = executable.toCommand().withArguments("--acp");

    Assert.areEqual("C:/npm/node.exe", command.executable);
    Assert.areEqual("C:/npm/node_modules/agent/bin/agent.js,--acp", command.arguments.join(","));
    Assert.areEqual(1, executable.arguments.length);
  }
}
