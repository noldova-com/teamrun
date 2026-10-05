/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessRequest, ProcessStartException } from "@noldova/teamrun-shell-runtime";

import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class BatchCommandLineTests {
  @TestMethod
  public async runsABatchFileThroughCmdWithEachArgumentEscapedTwice(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "run (1).cmd");
    await writeFile(file, "");
    const systemRoot = path.join(folder.path, "missing");
    const processes = ProcessSupervisorFixture.create(settings, "win32", { SystemRoot: systemRoot });

    const exception = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(file, ["a b", "x&y", "\"q\"", "back\\", ""], folder.path)),
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
      const processes = ProcessSupervisorFixture.create(settings, "win32", environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(file, launchArguments, folder.path)), ProcessStartException)).message;
    };

    Assert.areEqual(
      `${file} is a batch file, and cmd.exe cannot pass it an argument that holds a line break or a NUL character.`,
      await startAsync({ SystemRoot: folder.path }, ["one", "two\nlines"]));
    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", await startAsync({ SystemRoot: " " }, []));
  }
}
