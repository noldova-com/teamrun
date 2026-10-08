/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";
import { JsonException, JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DetachedStartReply, DetachedStartRequest, UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";
import { type IProcessStarter, LaunchException } from "@noldova/teamrun-shell-runtime";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeUtilityProcessHost } from "../fixtures/fake-utility-process-host.fixture.js";
import { LinkedUtilityProcessHost } from "../fixtures/linked-utility-process-host.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class UtilityProcessStarterTests {
  private static readonly BINARY_MISSING: string = "Electron's binary is not installed; run npm run build to install it.";

  @TestMethod
  public asksAUtilityProcessToStartTheProgram(): Promise<void> {
    const host = new FakeUtilityProcessHost();
    const environment = { ELECTRON_RUN_AS_NODE: "1" };

    const starting = new UtilityProcessStarter(host, { PATH: "C:\\Windows" }, "C:\\Users\\person\\work", "C:\\TeamRun\\utility-entry.js").startAsync("C:\\TeamRun\\TeamRun.exe", ["entry.js"], environment, "C:\\data\\start.log");
    const fork = host.forks[0];
    fork?.process.emit("message", DetachedStartReply.started(5120).toJson());

    return starting.then(processId => {
      Assert.areEqual(5120, processId);
      Assert.areEqual("C:\\TeamRun\\utility-entry.js", fork?.modulePath);
      Assert.areEqual(0, fork?.args.length);
      Assert.areEqual("ignore", fork?.options.stdio);
      Assert.areEqual("TeamRun runtime starter", fork?.options.serviceName);
      Assert.areEqual(JSON.stringify({ PATH: "C:\\Windows", ELECTRON_NO_ATTACH_CONSOLE: "1" }), JSON.stringify(fork?.options.env));
      Assert.areEqual("C:\\Users\\person\\work", fork?.options.cwd);
      Assert.areEqual(
        JSON.stringify(new DetachedStartRequest("C:\\TeamRun\\TeamRun.exe", ["entry.js"], "C:\\data\\start.log", environment).toJson()),
        JSON.stringify(fork?.process.messages[0]));
      Assert.areEqual("acknowledged", fork?.process.messages[1]);
    });
  }

  @TestMethod
  public async reportsAStartedProgramWhenTheStarterEndsTheMomentItMay(): Promise<void> {
    const programs: string[] = [];
    const program: IProcessStarter = {
      startAsync: executable => {
        programs.push(executable);
        return Promise.resolve(5120);
      }
    };

    const processId = await new UtilityProcessStarter(new LinkedUtilityProcessHost(program), {}, null, "utility-entry.js").startAsync("node", [], {}, "start.log");

    Assert.areEqual(5120, processId);
    Assert.areEqual("node", programs.join(","));
  }

  @TestMethod
  public async reportsAStarterThatFailsOrEnds(): Promise<void> {
    const host = new FakeUtilityProcessHost();
    const starter = new UtilityProcessStarter(host, {}, null, "utility-entry.js");

    const failing = starter.startAsync("node", [], {}, "start.log");
    host.forks[0]?.process.emit("message", DetachedStartReply.failed("LaunchException: The runtime could not be started with node.").toJson());
    const ending = starter.startAsync("node", [], {}, "start.log");
    host.forks[1]?.process.emit("exit", 1);
    const garbled = starter.startAsync("node", [], {}, "start.log");
    host.forks[2]?.process.emit("message", "started");

    Assert.areEqual(
      "The runtime starter could not start the runtime: LaunchException: The runtime could not be started with node.",
      (await Assert.throwsAsync(() => failing, LaunchException)).message);
    Assert.areEqual("The runtime starter ended before it started the runtime.", (await Assert.throwsAsync(() => ending, LaunchException)).message);
    await Assert.throwsAsync(() => garbled, JsonException);
    Assert.areEqual("acknowledged,,acknowledged", host.forks.map(t => t.process.messages[1] ?? "").join(","));
    Assert.isFalse(host.forks.some(t => "cwd" in t.options));
  }

  @TestMethod
  public findsItsUtilityEntryBesideThePackage(): void {
    Assert.areEqual("utility-entry.js", path.basename(UtilityProcessStarter.entryPath));
    Assert.isTrue(existsSync(UtilityProcessStarter.entryPath));
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  public async keepsTheDesktopsHandlesOutOfTheRuntimeOnWindows(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "tr-utility-"));
    const desktop = UtilityProcessStarterTests.startDesktop("utility-start-main.fixture.js", root);
    try {
      await desktop.ended;
      const runtime = UtilityProcessStarterTests.readProcessId(desktop.text, "runtime");

      Assert.isTrue(UtilityProcessStarterTests.isRunning(runtime), "the desktop's output ends while the runtime runs");
      Assert.areEqual(0, await desktop.exited, desktop.text.errors);
      await Condition.waitAsync(() => !UtilityProcessStarterTests.isRunning(UtilityProcessStarterTests.readProcessId(desktop.text, "utility")));
      Assert.isTrue(UtilityProcessStarterTests.isRunning(runtime), "the runtime outlives the desktop");
      process.kill(runtime);
      await Condition.waitAsync(() => !UtilityProcessStarterTests.isRunning(runtime));
    }
    finally {
      desktop.process.kill();
      await rm(`${root}-installation`, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 });
    }
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  public async endsAStarterWhoseDesktopEndedBeforeAcknowledgingOnWindows(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "tr-utility-"));
    const desktop = UtilityProcessStarterTests.startDesktop("utility-orphan-main.fixture.js", root);
    try {
      await desktop.ended;

      Assert.areEqual(0, await desktop.exited, desktop.text.errors);
      await Condition.waitAsync(() => !UtilityProcessStarterTests.isRunning(UtilityProcessStarterTests.readProcessId(desktop.text, "utility")));
    }
    finally {
      desktop.process.kill();
      await rm(root, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 });
    }
  }

  private static startDesktop(fixture: string, root: string): { process: ChildProcess; text: { output: string; errors: string }; ended: Promise<unknown>; exited: Promise<unknown> } {
    const electron = UtilityProcessStarterTests.findElectron();
    const main = fileURLToPath(new URL(`../fixtures/${fixture}`, import.meta.url));
    const environment = { ...process.env };
    delete environment["ELECTRON_RUN_AS_NODE"];
    const desktop = spawn(electron, [main, root], { stdio: ["ignore", "pipe", "pipe"], env: environment });
    const text = { output: "", errors: "" };
    desktop.stdout.setEncoding("utf8").on("data", (chunk: string) => text.output += chunk);
    desktop.stderr.setEncoding("utf8").on("data", (chunk: string) => text.errors += chunk);
    return { process: desktop, text, ended: once(desktop.stdout, "end"), exited: once(desktop, "exit").then(([code]: unknown[]) => code) };
  }

  private static findElectron(): string {
    const require = createRequire(import.meta.url);
    const directory = path.dirname(require.resolve("electron/package.json"));
    const pathFile = path.join(directory, "path.txt");
    if (!existsSync(pathFile) || !existsSync(path.join(directory, "dist", readFileSync(pathFile, "utf8"))))
      Assert.fail(UtilityProcessStarterTests.BINARY_MISSING);
    return String(require("electron"));
  }

  private static readProcessId(text: { output: string; errors: string }, name: string): number {
    Assert.isFalse(String.isNullOrWhitespace(text.output), text.errors);
    return JsonReader.fromValue(JSON.parse(text.output.trim())).readInteger(name);
  }

  private static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

}
