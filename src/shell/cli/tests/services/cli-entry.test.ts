/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { homedir } from "node:os";
import { PassThrough } from "node:stream";

import { Assert, CoverageEnvironment, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliEntry } from "@noldova/teamrun-shell-cli";
import { RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

@TestClass
export class CliEntryTests {
  @TestMethod
  public createsTheContextOfTheRunningProcess(): void {
    const context = CliEntry.createContext(process);

    Assert.areEqual(process.execPath, context.executablePath);
    Assert.areEqual(RuntimeEntry.entryPath, context.runtimeEntryPath);
    Assert.areEqual(RuntimeBuild.identity, context.identity);
    Assert.areEqual(homedir(), context.homeFolder);
    Assert.isTrue(context.output === process.stdout && context.error === process.stderr && context.input === process.stdin && context.signals === process);
    Assert.isTrue(CliEntry.entryPath.endsWith("cli-entry.js"));
  }

  @TestMethod
  public async runsAsAProgram(): Promise<void> {
    const child = spawn(process.execPath, [CliEntry.entryPath, "frobnicate"], { env: CoverageEnvironment.forChild(process.env), stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let output = "";
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => output += chunk);

    const [code] = await once(child, "exit");

    Assert.areEqual(2, code);
    Assert.isTrue(output.replaceAll("\r\n", "\n").startsWith("\"frobnicate\" is not a command.\n\nUsage: "), output);
  }

  @TestMethod
  public async settlesTheExitCodeARunEndsWith(): Promise<void> {
    const error = new PassThrough({ encoding: "utf8" });
    const exit: Pick<NodeJS.Process, "exitCode"> = { exitCode: undefined };

    await CliEntry.settleAsync(Promise.resolve(4), error, exit);

    Assert.areEqual(4, exit.exitCode);
    Assert.isNull(error.read());
  }

  @TestMethod
  public async writesARejectedRunAndExitsWithAFailure(): Promise<void> {
    const error = new PassThrough({ encoding: "utf8" });
    const exit: Pick<NodeJS.Process, "exitCode"> = { exitCode: undefined };

    await CliEntry.settleAsync(Promise.reject(new RangeError("The run broke.")), error, exit);

    Assert.areEqual(1, exit.exitCode);
    Assert.isTrue(String(error.read()).startsWith("RangeError: The run broke."));
  }
}
