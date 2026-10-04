/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { realpathSync } from "node:fs";
import { chmod, mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import {
  DataDirectory, OwnershipLock, ProcessRequest, ProcessSettings, ProcessStartException, ProcessSupervisor, ShellDatabase, ShellMigrations, SystemCommand
} from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ProcessSupervisorTests {
  private static readonly MODULE: string = "notes";
  private static readonly RECORDS: string = "SELECT module, program, process_id FROM owned_processes";

  @TestMethod
  public async startsAProgramFoundOnThePathInItsFolderWithOnlyTheVariablesItIsGiven(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const runtime: NodeJS.ProcessEnv = {
      ...Object.fromEntries(Object.entries(process.env).filter(([t]) => t.toUpperCase() !== "PATH")),
      PATH: path.dirname(process.execPath),
      TEAMRUN_INHERITED: "kept",
      TEAMRUN_DROPPED: "dropped"
    };
    const processes = ProcessSupervisorTests.create(settings, process.platform, runtime);
    const name = path.basename(process.execPath, path.extname(process.execPath));

    const owned = await processes.startAsync(
      ProcessSupervisorTests.MODULE,
      new ProcessRequest(name, [ProgramFixture.file, ProgramFixture.ENVIRONMENT], folder.path, { TEAMRUN_SET: "set" }, ["TEAMRUN_INHERITED", "TEAMRUN_MISSING"]));
    const running = processes.programs.map(t => `${t.moduleId} ${t.program} ${t.processId} ${t.started.getTime()}`);
    const recorded = settings.database.readAll(ProcessSupervisorTests.RECORDS);
    const runningBefore = owned.hasExited;
    let errors = "";
    owned.errors.setEncoding("utf8");
    owned.errors.on("data", (t: string) => {
      errors += t;
    });
    const errorsEnded = once(owned.errors, "end");
    const output = JSON.parse(await ProgramFixture.readAllAsync(owned)) as { folder: string; path: string; kept: [string, string][] };
    const exit = await owned.exited;
    await errorsEnded;
    await processes.stopOwnedByAsync(ProcessSupervisorTests.MODULE);

    Assert.areEqual(process.execPath, owned.program);
    Assert.areEqual(`notes ${process.execPath} ${owned.processId} ${owned.started.getTime()}`, running.join(","));
    Assert.areEqual(JSON.stringify([{ module: "notes", program: process.execPath, process_id: owned.processId }]), JSON.stringify(recorded));
    Assert.isFalse(runningBefore);
    Assert.areEqual(realpathSync(folder.path), realpathSync(output.folder));
    Assert.areEqual(path.dirname(process.execPath), output.path);
    Assert.areEqual("[[\"TEAMRUN_INHERITED\",\"kept\"],[\"TEAMRUN_SET\",\"set\"]]", JSON.stringify(output.kept));
    Assert.areEqual("environment", errors.trim());
    Assert.isTrue(exit.isClean);
    Assert.isTrue(owned.hasExited);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorTests.RECORDS).length);
    Assert.areEqual("", settings.diagnostics.text);
  }

  @TestMethod
  public async findsAWindowsProgramByEachRunnablePathExtExtensionInOrderPastFoldersWithVariableNamesInAnyCase(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const first = path.join(folder.path, "first");
    const second = path.join(folder.path, "second");
    const named = path.join(folder.path, "named");
    await mkdir(first);
    await mkdir(second);
    await mkdir(path.join(named, "tool.exe"), { recursive: true });
    for (const file of [path.join(first, "tool.cmd"), path.join(first, "tool.exe"), path.join(first, "tool.js"), path.join(first, "other.bat"), path.join(first, "script.js"), path.join(second, "tool.exe")])
      await writeFile(file, "");
    const runtime: NodeJS.ProcessEnv = { Path: first, SystemRoot: path.join(folder.path, "missing") };
    const locateAsync = async (environment: NodeJS.ProcessEnv, program: string, variables: Readonly<Record<string, string>> = {}): Promise<string> => {
      const processes = ProcessSupervisorTests.create(settings, "win32", environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorTests.MODULE, new ProcessRequest(program, [], folder.path, variables)), ProcessStartException)).message;
    };

    Assert.areEqual(`${path.join(first, "tool.cmd")} could not be started.`, await locateAsync({ ...runtime, PATHEXT: ".CMD;.EXE" }, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync({ ...runtime, PATHEXT: ".Exe;;.CMD" }, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync(runtime, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync({ ...runtime, PATHEXT: " " }, "tool"));
    Assert.areEqual(`${path.join(first, "other.bat")} could not be started.`, await locateAsync(runtime, "other"));
    Assert.areEqual(`${path.join(first, "tool.cmd")} could not be started.`, await locateAsync({ ...runtime, PATHEXT: ".EXE" }, "tool.cmd"));
    Assert.areEqual(`${path.join(second, "tool.exe")} could not be started.`, await locateAsync(runtime, "tool", { PATH: second }));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync({ ...runtime, Path: [named, first].join(";") }, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync({ ...runtime, PATHEXT: ".JS; .Exe " }, "tool"));
    Assert.areEqual("script.js was not found, or it is not a program that can be run.", await locateAsync({ ...runtime, PATHEXT: ".JS;.EXE" }, "script.js"));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorTests.RECORDS).length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async skipsFoldersAndFilesThatCannotRunWhenItSearchesThePath(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const [named, plain, runnable] = ["named", "plain", "runnable"].map(t => path.join(folder.path, t)) as [string, string, string];
    for (const directory of [named, plain, runnable])
      await mkdir(directory);
    await mkdir(path.join(named, "tool"));
    await writeFile(path.join(plain, "tool"), "");
    await chmod(path.join(plain, "tool"), 0o644);
    await symlink(process.execPath, path.join(runnable, "tool"));
    const processes = ProcessSupervisorTests.create(settings, process.platform, { PATH: ["relative", named, plain, runnable].join(":") });

    const owned = await processes.startAsync(ProcessSupervisorTests.MODULE, new ProcessRequest("tool", [ProgramFixture.file, ProgramFixture.EXIT, "0"], folder.path));
    await owned.exited;

    Assert.areEqual(path.join(runnable, "tool"), owned.program);
  }

  @TestMethod
  public async refusesARelativePathAndAProgramItCannotFind(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const startAsync = async (platform: string, environment: NodeJS.ProcessEnv, program: string): Promise<string> => {
      const processes = ProcessSupervisorTests.create(settings, platform, environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorTests.MODULE, new ProcessRequest(program, [], folder.path)), ProcessStartException)).message;
    };
    const missing = path.join(folder.path, "missing-tool");

    Assert.areEqual("bin/tool is neither a program's name nor an absolute path.", await startAsync("linux", { PATH: folder.path }, "bin/tool"));
    Assert.areEqual("bin\\tool is neither a program's name nor an absolute path.", await startAsync("win32", { PATH: folder.path }, "bin\\tool"));
    Assert.areEqual("\\tool is neither a program's name nor an absolute path.", await startAsync("win32", { PATH: folder.path }, "\\tool"));
    Assert.areEqual("C:tool is neither a program's name nor an absolute path.", await startAsync("win32", { PATH: folder.path }, "C:tool"));
    Assert.areEqual("missing-tool was not found, or it is not a program that can be run.", await startAsync("linux", { PATH: `relative:${folder.path}` }, "missing-tool"));
    Assert.areEqual("missing-tool was not found, or it is not a program that can be run.", await startAsync("win32", {}, "missing-tool"));
    Assert.areEqual(`${missing} was not found, or it is not a program that can be run.`, await startAsync("linux", {}, missing));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorTests.RECORDS).length);
  }

  @TestMethod
  public async runsABatchFileThroughCmdWithEachArgumentEscapedTwice(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "run (1).cmd");
    await writeFile(file, "");
    const systemRoot = path.join(folder.path, "missing");
    const processes = ProcessSupervisorTests.create(settings, "win32", { SystemRoot: systemRoot });

    const exception = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorTests.MODULE, new ProcessRequest(file, ["a b", "x&y", "\"q\"", "back\\", ""], folder.path)),
      ProcessStartException);

    const cause = exception.cause as { path: string; spawnargs: string[] };
    const line = cause.spawnargs[3];
    Assert.areEqual(`${file} could not be started.`, exception.message);
    Assert.areEqual(path.win32.join(systemRoot, "System32", "cmd.exe"), cause.path);
    Assert.areEqual("/d /s /c", cause.spawnargs.slice(0, 3).join(" "));
    Assert.areEqual(4, cause.spawnargs.length);
    Assert.isTrue(line?.startsWith("\"") === true, line);
    Assert.isTrue(line?.endsWith("run^ ^(1^).cmd ^^^\"a^^^ b^^^\" ^^^\"x^^^&y^^^\" ^^^\"\\^^^\"q\\^^^\"^^^\" ^^^\"back\\\\^^^\" ^^^\"^^^\"\"") === true, line);
  }

  @TestMethod
  public async refusesABatchArgumentWithALineBreakAndABatchFileWithoutSystemRoot(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "run.bat");
    await writeFile(file, "");
    const startAsync = async (environment: NodeJS.ProcessEnv, launchArguments: readonly string[]): Promise<string> => {
      const processes = ProcessSupervisorTests.create(settings, "win32", environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorTests.MODULE, new ProcessRequest(file, launchArguments, folder.path)), ProcessStartException)).message;
    };

    Assert.areEqual(
      `${file} is a batch file, and cmd.exe cannot pass it an argument that holds a line break or a NUL character.`,
      await startAsync({ SystemRoot: folder.path }, ["one", "two\nlines"]));
    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", await startAsync({ SystemRoot: " " }, []));
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async passesEachArgumentToABatchFileUnchanged(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const spaced = path.join(folder.path, "with space (1)");
    await mkdir(spaced);
    const file = path.join(spaced, "echo.cmd");
    await writeFile(file, `@"${process.execPath}" "${ProgramFixture.file}" ${ProgramFixture.ARGUMENTS} %*\r\n`);
    const launchArguments = ["a b", "x&y", "100%", "%PATH%", "\"q\"", "back\\", "", "^caret", "semi;colon", "a,b", "!bang!", "<in>|out", "(x)"];
    const processes = ProcessSupervisorTests.create(settings);

    const owned = await processes.startAsync(ProcessSupervisorTests.MODULE, new ProcessRequest("echo", launchArguments, folder.path, { PATH: spaced }));
    const output = await ProgramFixture.readAllAsync(owned);

    Assert.areEqual(path.join(spaced, "echo.cmd"), owned.program);
    Assert.areEqual(JSON.stringify(launchArguments), output);
    Assert.isTrue((await owned.exited).isClean);
  }

  @TestMethod
  public async reportsAProgramThatCannotStartAndRecordsNothing(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorTests.create(settings);

    const missingFolder = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorTests.MODULE, ProgramFixture.request(path.join(folder.path, "missing"), [ProgramFixture.WAIT])),
      ProcessStartException);
    const invalidArgument = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorTests.MODULE, ProgramFixture.request(folder.path, ["nul\0"])),
      ProcessStartException);

    Assert.areEqual(`${process.execPath} could not be started.`, missingFolder.message);
    Assert.areEqual("ENOENT", (missingFolder.cause as { code: string }).code);
    Assert.areEqual(`${process.execPath} could not be started.`, invalidArgument.message);
    Assert.areEqual("ERR_INVALID_ARG_VALUE", (invalidArgument.cause as { code: string }).code);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorTests.RECORDS).length);
  }

  @TestMethod
  public async endsAProgramItCannotRecord(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    database.close();
    const processes = new ProcessSupervisor(database, process.platform, process.env, new SystemCommand(), new TextOutputFixture());

    const failure = await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])), Error);

    Assert.isFalse(failure instanceof ProcessStartException);
    Assert.areEqual(0, processes.programs.length);
  }

  @TestMethod
  public async refusesARequestWhoseSignalHasAlreadyAborted(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorTests.create(settings);

    const failure = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], AbortSignal.abort())),
      Error);

    Assert.areEqual("AbortError", failure.name);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorTests.RECORDS).length);
  }

  @TestMethod
  public async stopsAProgramWhenItsSignalAbortsWhileItRunsOrStarts(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorTests.create(settings);
    const running = new AbortController();
    const starting = new AbortController();

    const owned = await processes.startAsync(ProcessSupervisorTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], running.signal));
    const ready = await ProgramFixture.readLineAsync(owned);
    running.abort();
    await owned.exited;
    const pending = processes.startAsync(ProcessSupervisorTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], starting.signal));
    starting.abort();
    const aborted = await pending;
    await aborted.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorTests.MODULE);

    Assert.areEqual(ProgramFixture.READY, ready);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorTests.RECORDS).length);
  }

  @TestMethod
  public async reportsAnErrorOnAProgramsInputInTheLog(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorTests.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorTests.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));

    owned.input.emit("error", new Error("write EPIPE"));
    await owned.stopAsync();

    Assert.isTrue(settings.diagnostics.text.startsWith(`The module notes's program ${process.execPath} (process ${owned.processId}): Error: write EPIPE`), settings.diagnostics.text);
  }

  private static create(
    settings: SettingsFixture,
    platform: string = process.platform,
    environment: NodeJS.ProcessEnv = process.env): ProcessSupervisor {
    return new ProcessSupervisor(settings.database, platform, environment, new SystemCommand(), settings.diagnostics, new ProcessSettings(300, 500));
  }
}
