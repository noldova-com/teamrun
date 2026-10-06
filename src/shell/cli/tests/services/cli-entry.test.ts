/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";

import { Assert, CoverageEnvironment, TestClass, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";
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
  public async endsTheProgramAfterItsResultEvenWhileAnotherTaskWouldKeepItRunning(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-cli-entry-"));
    try {
      const keeper = path.join(folder, "keeper.mjs");
      await writeFile(keeper, "setInterval(() => undefined, 60_000);\n");
      const child = spawn(process.execPath, ["--import", pathToFileURL(keeper).href, CliEntry.entryPath, "frobnicate"],
        { env: CoverageEnvironment.forChild(process.env), stdio: ["ignore", "ignore", "ignore"], windowsHide: true });

      const hasEnded = await Wait.untilAsync(() => child.exitCode !== null, 15_000);
      child.kill();

      Assert.isTrue(hasEnded, "The program still ran 15 s after its result.");
      Assert.areEqual(2, child.exitCode);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async settlesTheExitCodeARunEndsWithAndEndsTheProcessAfterTheStreamsAreWritten(): Promise<void> {
    const output = new PassThrough({ encoding: "utf8" });
    const error = new PassThrough({ encoding: "utf8" });
    const exited: string[] = [];
    const exit: Pick<NodeJS.Process, "exitCode"> & { exit(): void } = { exitCode: undefined, exit: () => void exited.push(String(output.read() ?? "")) };
    output.write("Result.\n");

    await CliEntry.settleAsync(Promise.resolve(4), output, error, exit);

    Assert.areEqual(4, exit.exitCode);
    Assert.areEqual(JSON.stringify(["Result.\n"]), JSON.stringify(exited));
    Assert.isNull(error.read());
  }

  @TestMethod
  public async writesARejectedRunAndExitsWithAFailure(): Promise<void> {
    const output = new PassThrough({ encoding: "utf8" });
    const error = new PassThrough({ encoding: "utf8" });
    let exits = 0;
    const exit: Pick<NodeJS.Process, "exitCode"> & { exit(): void } = { exitCode: undefined, exit: () => void exits++ };

    await CliEntry.settleAsync(Promise.reject(new RangeError("The run broke.")), output, error, exit);

    Assert.areEqual(1, exit.exitCode);
    Assert.areEqual(1, exits);
    Assert.isTrue(String(error.read()).startsWith("RangeError: The run broke."));
  }
}
