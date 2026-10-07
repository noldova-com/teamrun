/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChildProgramHost, ProgramException } from "@noldova/teamrun-shell-desktop";
import { LaunchException } from "@noldova/teamrun-shell-runtime";

import { Condition } from "../fixtures/condition.fixture.js";
import { MissingBashFixture } from "../fixtures/missing-bash.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";

const MISSING = path.join(path.dirname(process.execPath), "teamrun-missing-program");

@TestClass
export class ChildProgramHostTests {
  private static readonly LISTER: string = [
    "const { ChildProgramHost } = await import(process.argv[1]);",
    "const host = new ChildProgramHost(process.argv[2], 5000);",
    "const ran = await host.runAsync('/bin/ls', ['/proc/self/fd'], process.env);",
    "let started = '';",
    "await new Promise(resolve => host.start('/bin/ls', ['/proc/self/fd'], process.env, t => started += t, resolve));",
    "const { existsSync, readFileSync } = await import('node:fs');",
    "host.startDetached('/bin/sh', ['-c', 'ls /proc/self/fd > \"$0.part\" && mv \"$0.part\" \"$0\"', process.argv[3]], process.env, () => undefined);",
    "for (let i = 0; i < 250 && !existsSync(process.argv[3]); i++) await new Promise(resolve => setTimeout(resolve, 20));",
    "const detached = readFileSync(process.argv[3], 'utf8');",
    "process.stdout.write([ran, started, detached].map(t => t.trim().split(/\\s+/).join(',')).join('|'));"
  ].join("\n");

  @TestMethod
  public async runsAProgramWithTheGivenEnvironmentAndReturnsItsOutput(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 5000);

    const output = await host.runAsync(process.execPath, ["-e", "process.stdout.write(`${process.argv[1]} ${process.env.TRAY_ANSWER}`)", "(<true>,)"], { ...process.env, TRAY_ANSWER: "answered" });

    Assert.areEqual("(<true>,) answered", output);
  }

  @TestMethod
  public async failsWithTheProgramNamedWhenItFailsIsMissingOrRunsTooLong(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 300);

    const failures = [
      await Assert.throwsAsync(() => host.runAsync(process.execPath, ["-e", "process.exit(3)"], process.env), ProgramException),
      await Assert.throwsAsync(() => host.runAsync(MISSING, [], process.env), ProgramException),
      await Assert.throwsAsync(() => host.runAsync(process.execPath, ["-e", "setTimeout(() => undefined, 10000)"], process.env), ProgramException)
    ];

    Assert.isTrue(failures[0]?.message.startsWith(`${process.execPath} failed: `) === true, failures[0]?.message);
    Assert.isTrue(failures[1]?.message.startsWith(`${MISSING} failed: `) === true, failures[1]?.message);
    Assert.isTrue(failures.every(t => t.cause instanceof Error));
  }

  @TestMethod
  public async passesAStartedProgramsOutputOnAndTellsOnceWhenItEnds(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 5000);
    const output: string[] = [];
    let exits = 0;

    host.start(process.execPath, ["-e", "process.stdout.write(process.env.TRAY_ANSWER ?? '')"], { ...process.env, TRAY_ANSWER: "NameOwnerChanged" }, t => output.push(t), () => exits++);

    await Condition.waitAsync(() => exits > 0);
    Assert.areEqual("NameOwnerChanged", output.join(""));
    Assert.areEqual(1, exits);
  }

  @TestMethod
  public async startsADetachedProgramWithTheGivenEnvironment(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-detached-"));
    const file = path.join(folder, "started");
    try {
      new ChildProgramHost(process.platform, 5000).startDetached(process.execPath, ["-e", "require('node:fs').writeFileSync(process.argv[1], process.env.HANDOVER_ANSWER)", file], { ...process.env, HANDOVER_ANSWER: "handed over" }, () => undefined);

      await Condition.waitAsync(() => existsSync(file) && readFileSync(file, "utf8").length > 0);
      Assert.areEqual("handed over", readFileSync(file, "utf8"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async startsADetachedProgramInTheGivenFolderAndAnswersOnceItHasStarted(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-relaunch-"));
    const file = path.join(folder, "started");
    try {
      await new ChildProgramHost(process.platform, 5000).startDetachedAsync(process.execPath, [
        "-e",
        "const fs = require('node:fs'); fs.writeFileSync(`${process.argv[1]}.part`, `${process.pid}|${fs.realpathSync.native(process.cwd())}|${process.env.RELAUNCH_ANSWER}`); fs.renameSync(`${process.argv[1]}.part`, process.argv[1]);",
        file
      ], { ...process.env, RELAUNCH_ANSWER: "relaunched" }, folder);

      await Condition.waitAsync(() => existsSync(file));
      const [processId, ...answer] = readFileSync(file, "utf8").split("|");
      await Condition.waitAsync(() => !ChildProgramHostTests.isRunning(Number(processId)));
      Assert.areEqual(`${realpathSync.native(folder)}|relaunched`, answer.join("|"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async rejectsADetachedProgramThatCannotStart(): Promise<void> {
    let bash: Error;
    {
      using _bash = new MissingBashFixture();
      bash = await Assert.throwsAsync(() => new ChildProgramHost("linux", 5000).startDetachedAsync("/opt/teamrun/teamrun", [], process.env, tmpdir()), LaunchException);
    }
    const missing = await Assert.throwsAsync(() => new ChildProgramHost("win32", 5000).startDetachedAsync(MISSING, [], process.env, tmpdir()), Error);

    Assert.areEqual("Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions.", bash.message);
    Assert.areEqual(`spawn ${MISSING} ENOENT`, missing.message);
  }

  @TestMethod
  public async reportsADetachedProgramThatCannotStart(): Promise<void> {
    const failures: Error[] = [];
    {
      using _bash = new MissingBashFixture();
      new ChildProgramHost("linux", 5000).startDetached("/opt/teamrun/teamrun", [], process.env, t => failures.push(t));
    }
    new ChildProgramHost("win32", 5000).startDetached(MISSING, [], process.env, t => failures.push(t));

    await Condition.waitAsync(() => failures.length === 2);
    Assert.areEqual("Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions.", failures[0]?.message);
    Assert.areEqual(`spawn ${MISSING} ENOENT`, failures[1]?.message);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsProgramsOnLinuxWithoutTheDescriptorsTheDesktopHolds(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "teamrun-descriptors-"));
    const [linux, direct] = await Promise.all(["linux", "win32"].map(t => ChildProgramHostTests.listDescriptorsAsync(t, path.join(folder, t))))
      .finally(() => rm(folder, { recursive: true, force: true }));

    Assert.isTrue(direct?.every(t => t.some(u => u > 3)) === true, `programs started directly inherit the descriptors Node opened without closing them on exec: ${JSON.stringify(direct)}`);
    Assert.areEqual("[[0,1,2,3],[0,1,2,3],[0,1,2,3]]", JSON.stringify(linux), "only the standard descriptors and the one ls opens itself remain");
  }

  @TestMethod
  public async failsOrEndsOnLinuxWithoutBashAndRefusesAnEmptyPath(): Promise<void> {
    const host = new ChildProgramHost("linux", 5000);
    let exits = 0;
    {
      using _bash = new MissingBashFixture();
      host.start("/usr/bin/gdbus", [], process.env, () => undefined, () => exits++).stop();
    }
    const failure = await Assert.throwsAsync(() => {
      using _bash = new MissingBashFixture();
      return host.runAsync("/usr/bin/gdbus", [], process.env);
    }, ProgramException);

    await Condition.waitAsync(() => exits > 0);
    Assert.areEqual(1, exits);
    Assert.areEqual("/usr/bin/gdbus failed: Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions.", failure.message);
    Assert.areEqual("executablePath", (await Assert.throwsAsync(() => host.runAsync(" ", [], process.env), ArgumentException)).parameterName);
    Assert.areEqual("executablePath", Assert.throws(() => host.start(" ", [], process.env, () => undefined, () => undefined), ArgumentException).parameterName);
  }

  @TestMethod
  public async stopsAStartedProgramAndTellsOnceWhenOneIsMissing(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 5000);
    let exits = 0;
    let missingExits = 0;
    new ChildProgramHost("win32", 5000).start(MISSING, [], process.env, () => undefined, () => missingExits++);
    const running = host.start(process.execPath, ["-e", "setTimeout(() => undefined, 10000)"], process.env, () => undefined, () => exits++);

    running.stop();

    await Condition.waitAsync(() => exits > 0);
    Assert.areEqual(1, exits);
    Assert.areEqual(1, missingExits);
  }

  private static async listDescriptorsAsync(platform: string, file: string): Promise<number[][]> {
    const child = spawn(process.execPath, ["--input-type=module", "-e", ChildProgramHostTests.LISTER, import.meta.resolve("@noldova/teamrun-shell-desktop"), platform, file], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout?.setEncoding("utf8").on("data", (t: string) => output += t);
    await once(child, "close");
    return output.split("|").map(t => t.split(",").map(Number).sort((u, v) => u - v));
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
