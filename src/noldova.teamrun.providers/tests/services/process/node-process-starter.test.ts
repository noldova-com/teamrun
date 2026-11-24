/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRunner, LocalAcpCommand, NodeProcessStarter, ProcessCommand, ProcessTerminator } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class NodeProcessStarterTests {
  @TestMethod
  public async runsAWindowsBatchFileWithAQuoteAndAnAmpersandInItsArguments(): Promise<void> {
    if (process.platform !== "win32")
      return;
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve("echo.js"), "process.stdout.write(JSON.stringify(process.argv.slice(2)));");
    writeFileSync(directory.resolve("agent.cmd"), `@echo off\r\n"${process.execPath}" "%~dp0echo.js" %*\r\n`);
    const args = ['say "hi" & exit', "plain"];
    const environment = { PATH: directory.path, PATHEXT: ".cmd", COMSPEC: process.env["COMSPEC"], SystemRoot: process.env["SystemRoot"] };
    const command = new LocalAcpCommand("agent", "Agent", "agent", args).commandFor("win32", environment);

    const result = await new CommandRunner(new NodeProcessStarter(new ProcessTerminator("win32"))).run(command, environment, 30_000);

    Assert.areEqual(JSON.stringify(args), result.stdout, result.stderr);
  }

  @TestMethod
  public async runsTheNodeOnPathFromABatchShimOnWindowsAndNotANodeCmdInTheWorkingFolder(): Promise<void> {
    if (process.platform !== "win32")
      return;
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("bin");
    const work = directory.resolve("work");
    mkdirSync(bin);
    mkdirSync(work);
    writeFileSync(path.join(bin, "agent.cmd"), "@node -e \"process.stdout.write('path')\"\r\n");
    writeFileSync(path.join(work, "node.cmd"), "@echo planted\r\n");
    const inherited = Object.entries(process.env).filter(t => !["PATH", "PATHEXT", "NODEFAULTCURRENTDIRECTORYINEXEPATH"].includes(t[0].toUpperCase()));
    const environment = { ...Object.fromEntries(inherited), PATH: `${bin};${path.dirname(process.execPath)}`, PATHEXT: ".EXE;.CMD" };
    const command = new LocalAcpCommand("agent", "Agent", "agent", []).commandFor("win32", environment);

    const child = new NodeProcessStarter(new ProcessTerminator("win32")).start(command, environment, work);
    let read = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => read += chunk);
    child.stderr.resume();
    await once(child, "close");

    Assert.areEqual("path", read.trim());
  }

  @TestMethod
  public async startsAProgramInItsDirectoryWithItsEnvironmentAndStopsIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve("marker.txt"), "fixture");
    const script = "process.stdout.write(require('node:fs').existsSync('marker.txt') + '|' + process.env.TEAMRUN_STARTER_TEST + '|'); process.stdin.resume();";
    const starter = new NodeProcessStarter(new ProcessTerminator(process.platform));

    const child = starter.start(new ProcessCommand(process.execPath, ["-e", script]), { ...process.env, TEAMRUN_STARTER_TEST: "set" }, directory.path);
    let read = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => read += chunk);
    child.stderr.resume();
    await once(child, "spawn");
    await Wait.until(() => read.endsWith("|"), "The process's output did not end with '|'.");
    const closed = once(child, "close");
    await child.stopAsync();
    await closed;

    Assert.areEqual("true|set|", read);
    Assert.isTrue((child.pid ?? 0) > 0);
    Assert.isTrue(child.hasExited);
  }

  @TestMethod
  public async reportsAProgramThatCannotStart(): Promise<void> {
    using directory = new TemporaryDirectory();
    const starter = new NodeProcessStarter(new ProcessTerminator(process.platform));

    const child = starter.start(new ProcessCommand(directory.resolve("missing-program"), []), process.env, null);
    const [error] = await once(child, "error");

    Assert.isInstanceOf(error, Error);
    Assert.isUndefined(child.pid);
  }
}
