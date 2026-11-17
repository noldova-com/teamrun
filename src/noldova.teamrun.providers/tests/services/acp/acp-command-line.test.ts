/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFileSync } from "node:fs";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpCommandLine, AgentLaunchException, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

const SHELL = "C:\\Windows\\System32\\cmd.exe";

@TestClass
export class AcpCommandLineTests {
  @TestMethod
  public runsAProgramDirectlyAndABatchFileThroughItsVariablesShell(): void {
    using directory = new TemporaryDirectory();
    const batch = directory.resolve("agent.cmd");
    const program = directory.resolve("agent.exe");
    writeFileSync(batch, "");
    writeFileSync(program, "");
    const environment = { PATH: directory.path, PATHEXT: ".exe;.cmd", UNSET: undefined };

    const posix = AcpCommandLine.of("linux", environment, {}, "agent", ["a & b"]);
    const direct = AcpCommandLine.of("win32", environment, {}, program, ["a & b"]);
    const throughShell = AcpCommandLine.of("win32", environment, { COMSPEC: SHELL }, batch, ["a & b"]);

    Assert.areEqual("agent|a & b|false", [posix.executable, posix.arguments.join(","), posix.isVerbatim].join("|"));
    Assert.areEqual(`${program}|a & b|false`, [direct.executable, direct.arguments.join(","), direct.isVerbatim].join("|"));
    Assert.areEqual(`${SHELL}|true`, `${throughShell.executable}|${throughShell.isVerbatim}`);
    Assert.isTrue(throughShell.arguments.at(-1)!.includes("^^^&"));
  }

  @TestMethod
  public refusesALineBreakOnlyInABatchFilesArgument(): void {
    using directory = new TemporaryDirectory();
    const batch = directory.resolve("agent.cmd");
    const program = directory.resolve("agent.exe");
    writeFileSync(batch, "");
    writeFileSync(program, "");

    for (const argument of ["one\ntwo", "one\rtwo", "one\r\ntwo"]) {
      const environment = { COMSPEC: SHELL };

      Assert.areEqual(Resources.formatAcpArgumentLineBreak(batch), Assert.throws(() => AcpCommandLine.of("win32", environment, {}, batch, ["plain", argument]), AgentLaunchException).message, argument);
      Assert.areEqual(argument, AcpCommandLine.of("win32", environment, {}, program, [argument]).arguments[0], argument);
      Assert.areEqual(argument, AcpCommandLine.of("linux", environment, {}, batch, [argument]).arguments[0], argument);
    }
    Assert.areEqual(`${batch} is a batch file, and Windows ends a batch file's command line at a line break, so an argument with one can't reach it.`, Resources.formatAcpArgumentLineBreak(batch));
  }
}
