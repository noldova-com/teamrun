/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataDirectory, OwnershipLock, ProcessSupervisor, ShellDatabase, ShellMigrations } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IProcessStarter, type ProcessCommand, StartedProcess } from "@noldova/teamrun.providers";
import { RuntimeCommandStarter, RuntimeProcessStarter } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";
import { RecordingOutput } from "../fixtures/recording-output.fixture.js";
import { RecordingPartContext } from "../fixtures/recording-part-context.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class RuntimeCommandStarterTests {
  @TestMethod
  public async runsTheCommandThroughThePersonsShellInTheWorkFolder(): Promise<void> {
    const starter = new RecordingStarter();
    const cases: [NodeJS.ProcessEnv, string][] = [
      [{ ComSpec: "C:\\Windows\\System32\\cmd.exe" }, "win32"],
      [{ ComSpec: " " }, "win32"],
      [{ SHELL: "/bin/zsh" }, "darwin"],
      [{}, "linux"]
    ];

    for (const [environment, platform] of cases)
      new RuntimeCommandStarter(starter, environment, platform).start("npm test", "/work", () => undefined);
    await RuntimeCommandStarterTests.startedAsync(starter, cases.length);

    Assert.areEqual(JSON.stringify([
      ["C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "\"npm test\""], true, "/work"],
      ["cmd.exe", ["/d", "/s", "/c", "\"npm test\""], true, "/work"],
      ["/bin/zsh", ["-c", "npm test"], false, "/work"],
      ["/bin/sh", ["-c", "npm test"], false, "/work"]
    ]), JSON.stringify(starter.calls.map(t => [t.command.executable, t.command.arguments, t.command.isVerbatim, t.directory])));
    Assert.isTrue(starter.owns[3] === cases[3]?.[0]);
  }

  @TestMethod
  public async runsTheCommandWithThePersonsCurrentEnvironmentAndShellNotTheRuntimes(): Promise<void> {
    const starter = new RecordingStarter({ SHELL: "/bin/fish", PATH: "/person/bin" });
    const own: NodeJS.ProcessEnv = { SHELL: "/bin/zsh", PATH: "/runtime/bin" };

    new RuntimeCommandStarter(starter, own, "linux").start("npm test", "/work", () => undefined);
    await RuntimeCommandStarterTests.startedAsync(starter, 1);

    Assert.isTrue(starter.owns[0] === own);
    Assert.areEqual("/bin/fish", starter.calls[0]?.command.executable);
    Assert.areEqual(JSON.stringify({ SHELL: "/bin/fish", PATH: "/person/bin" }), JSON.stringify(starter.calls[0]?.environment));
  }

  @TestMethod
  public async runsACommandWithItsQuotesAndOperatorsAsWrittenThroughDesktopCore(): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase();
    const supervisor = ProcessSupervisor.create(shell, process.platform, process.env, new RecordingOutput());
    const context = new RecordingPartContext(directory.path, database, directory.path);
    context.startProcess = request => supervisor.startAsync("teamrun", request);
    const output: string[] = [];
    try {
      const running = new RuntimeCommandStarter(new RuntimeProcessStarter(context, directory.path)).start(
        `"${process.execPath}" -e "console.log(JSON.stringify(process.argv.slice(1)))" "a b" "x&y" plain`, directory.path, text => output.push(text));
      const exit = await running.exited;

      Assert.areEqual(JSON.stringify({ code: 0, signal: null, error: null }), JSON.stringify(exit));
      Assert.areEqual(JSON.stringify(["a b", "x&y", "plain"]), output.join("").trim());
      Assert.areEqual(process.platform === "win32", context.requests[0]?.isVerbatim);
    }
    finally {
      await supervisor.stopAllAsync();
    }
  }

  @TestMethod
  public async runsEveryLineOfATwoLineCommandOutsideWindowsAndRefusesItOnWindowsWhereCmdRunsOnlyTheFirst(): Promise<void> {
    using directory = new TemporaryDirectory();
    using shellFolder = new TemporaryDirectory();
    using lock = OwnershipLock.acquire(new DataDirectory(shellFolder.path));
    using shell = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), new RecordingOutput());
    using database = new MemoryModuleDatabase();
    const supervisor = ProcessSupervisor.create(shell, process.platform, process.env, new RecordingOutput());
    const context = new RecordingPartContext(directory.path, database, directory.path);
    context.startProcess = request => supervisor.startAsync("teamrun", request);
    const output: string[] = [];
    try {
      const commands = new RuntimeCommandStarter(new RuntimeProcessStarter(context, directory.path));
      const refusal = commands.refusalOf("echo one\necho two");
      const exit = await commands.start("echo one\necho two", directory.path, text => output.push(text)).exited;

      const isWindows = process.platform === "win32";
      Assert.areEqual(isWindows ? "On Windows, cmd.exe runs only a command's first line; join its commands with && on one line." : null, refusal);
      Assert.areEqual(JSON.stringify({ code: 0, signal: null, error: null }), JSON.stringify(exit));
      Assert.areEqual(JSON.stringify(isWindows ? ["one"] : ["one", "two"]), JSON.stringify(output.join("").trim().split(/\r?\n/)));
    }
    finally {
      await supervisor.stopAllAsync();
    }
  }

  @TestMethod
  public refusesALineBreakOnlyOnWindows(): void {
    const starter = new RecordingStarter();
    const refusal = "On Windows, cmd.exe runs only a command's first line; join its commands with && on one line.";
    const cases: [string, string, string | null][] = [
      ["win32", "npm ci\nnpm test", refusal],
      ["win32", "npm ci\r\nnpm test", refusal],
      ["win32", "npm ci\rnpm test", refusal],
      ["win32", "npm ci && npm test", null],
      ["darwin", "npm ci\nnpm test", null],
      ["linux", "npm ci\nnpm test", null]
    ];

    Assert.areEqual(JSON.stringify(cases.map(t => t[2])),
      JSON.stringify(cases.map(([platform, command]) => new RuntimeCommandStarter(starter, {}, platform).refusalOf(command))));
    Assert.areEqual(0, starter.calls.length);
  }

  @TestMethod
  public async passesBothOutputsOnAndEndsWithTheProgramsCodeOrSignal(): Promise<void> {
    const starter = new RecordingStarter();
    const output: string[] = [];
    const commands = new RuntimeCommandStarter(starter, {}, "linux");
    const failed = commands.start("npm test", "/work", text => output.push(text));
    const stopped = commands.start("npm start", "/work", () => undefined);
    await RuntimeCommandStarterTests.startedAsync(starter, 2);
    const [first, second] = starter.started;
    Assert.isDefined(first);
    Assert.isDefined(second);

    first.stdout.write("one\n");
    first.stderr.write("two\n");
    first.end(1, null);
    second.end(null, "SIGTERM");

    Assert.areEqual(JSON.stringify({ code: 1, signal: null, error: null }), JSON.stringify(await failed.exited));
    Assert.areEqual(JSON.stringify({ code: null, signal: "SIGTERM", error: null }), JSON.stringify(await stopped.exited));
    Assert.areEqual("one\ntwo\n", output.join(""));
  }

  @TestMethod
  public async endsWithTheErrorOfAProgramThatCouldNotStartAndSettlesAStopAskedBeforeIt(): Promise<void> {
    const starter = new RecordingStarter();
    const running = new RuntimeCommandStarter(starter, {}, "linux").start("npm test", "/work", () => undefined);
    await RuntimeCommandStarterTests.startedAsync(starter, 1);

    const [started] = starter.started;
    Assert.isDefined(started);
    const stopping = running.stopAsync();
    started.fail(new Error("spawn /bin/sh ENOENT"));
    await stopping;

    Assert.areEqual(JSON.stringify({ code: null, signal: null, error: "spawn /bin/sh ENOENT" }), JSON.stringify(await running.exited));
  }

  @TestMethod
  public async endsWithTheErrorOfAStartRefusedAtOnceAndSettlesAStopAfterIt(): Promise<void> {
    const starter = new RecordingStarter();
    starter.startRefusal = new Error("The module is stopping.");
    const running = new RuntimeCommandStarter(starter, {}, "linux").start("npm test", "/work", () => undefined);

    const exit = await running.exited;
    await running.stopAsync();

    Assert.areEqual(JSON.stringify({ code: null, signal: null, error: "The module is stopping." }), JSON.stringify(exit));
    Assert.areEqual(1, starter.calls.length);
  }

  @TestMethod
  public async stopsAtOnceWhileThePersonsEnvironmentIsReadAndThenStartsNothing(): Promise<void> {
    const starter = new RecordingStarter(null, null, true);
    const running = new RuntimeCommandStarter(starter, {}, "linux").start("npm test", "/work", () => undefined);

    await running.stopAsync();
    const exit = await running.exited;
    const [read] = starter.reads;
    Assert.isDefined(read);
    read.resolve({});
    await read.promise;

    Assert.areEqual(JSON.stringify({ code: null, signal: null, error: null }), JSON.stringify(exit));
    Assert.areEqual(0, starter.calls.length);
  }

  @TestMethod
  public async endsWithTheErrorOfAnEnvironmentThatCouldNotBeReadAndStartsNothing(): Promise<void> {
    const results: string[] = [];
    for (const reason of [new Error("The environment could not be read."), "not an error"]) {
      const starter = new RecordingStarter({}, reason);
      const running = new RuntimeCommandStarter(starter, {}, "linux").start("npm test", "/work", () => undefined);

      results.push(JSON.stringify(await running.exited), String(starter.calls.length));
      await running.stopAsync();
    }

    Assert.areEqual(JSON.stringify([
      JSON.stringify({ code: null, signal: null, error: "The environment could not be read." }), "0",
      JSON.stringify({ code: null, signal: null, error: "not an error" }), "0"
    ]), JSON.stringify(results));
  }

  private static async startedAsync(starter: RecordingStarter, count: number): Promise<void> {
    for (let tick = 0; tick < 10 && starter.started.length < count; tick++)
      await Promise.resolve();
  }
}

class RecordingStarter implements IProcessStarter {
  public readonly calls: { command: ProcessCommand; environment: NodeJS.ProcessEnv; directory: string | null }[] = [];
  public readonly started: StartedProcess[] = [];
  public readonly owns: NodeJS.ProcessEnv[] = [];
  public readonly reads: PromiseWithResolvers<NodeJS.ProcessEnv>[] = [];
  public startRefusal: Error | null = null;
  private readonly person: NodeJS.ProcessEnv | null;
  private readonly refusal: unknown;
  private readonly isHeld: boolean;

  public constructor(person: NodeJS.ProcessEnv | null = null, refusal: unknown = null, isHeld: boolean = false) {
    this.person = person;
    this.refusal = refusal;
    this.isHeld = isHeld;
  }

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    const started = new StartedProcess();
    this.calls.push({ command, environment, directory });
    this.started.push(started);
    const refusal = this.startRefusal;
    if (!Object.isNull(refusal))
      void Promise.resolve().then(() => {
        started.fail(refusal);
        started.end(null, null);
      });
    return started;
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    this.owns.push(own);
    if (!Object.isNull(this.refusal))
      return Promise.reject(this.refusal);
    if (!this.isHeld)
      return Promise.resolve(this.person ?? { ...own });
    const read = Promise.withResolvers<NodeJS.ProcessEnv>();
    this.reads.push(read);
    return read.promise;
  }
}
