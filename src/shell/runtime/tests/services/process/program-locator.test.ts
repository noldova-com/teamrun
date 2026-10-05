/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessRequest, ProcessStartException } from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProgramLocatorTests {
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
      const processes = ProcessSupervisorFixture.create(settings, "win32", environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(program, [], folder.path, variables)), ProcessStartException)).message;
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
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
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
    const processes = ProcessSupervisorFixture.create(settings, process.platform, { PATH: ["relative", named, plain, runnable].join(":") });

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest("tool", [ProgramFixture.file, ProgramFixture.EXIT, "0"], folder.path));
    await owned.exited;

    Assert.areEqual(path.join(runnable, "tool"), owned.program);
  }

  @TestMethod
  public async refusesARelativePathAndAProgramItCannotFind(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const startAsync = async (platform: string, environment: NodeJS.ProcessEnv, program: string): Promise<string> => {
      const processes = ProcessSupervisorFixture.create(settings, platform, environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(program, [], folder.path)), ProcessStartException)).message;
    };
    const missing = path.join(folder.path, "missing-tool");

    Assert.areEqual("bin/tool is neither a program's name nor an absolute path.", await startAsync("linux", { PATH: folder.path }, "bin/tool"));
    Assert.areEqual("bin\\tool is neither a program's name nor an absolute path.", await startAsync("win32", { PATH: folder.path }, "bin\\tool"));
    Assert.areEqual("\\tool is neither a program's name nor an absolute path.", await startAsync("win32", { PATH: folder.path }, "\\tool"));
    Assert.areEqual("C:tool is neither a program's name nor an absolute path.", await startAsync("win32", { PATH: folder.path }, "C:tool"));
    Assert.areEqual("missing-tool was not found, or it is not a program that can be run.", await startAsync("linux", { PATH: `relative:${folder.path}` }, "missing-tool"));
    Assert.areEqual("missing-tool was not found, or it is not a program that can be run.", await startAsync("win32", {}, "missing-tool"));
    Assert.areEqual(`${missing} was not found, or it is not a program that can be run.`, await startAsync("linux", {}, missing));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
