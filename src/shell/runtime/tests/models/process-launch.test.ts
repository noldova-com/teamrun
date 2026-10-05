/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessRequest } from "@noldova/teamrun-shell-runtime";

import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../fixtures/program.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProcessLaunchTests {
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
    const processes = ProcessSupervisorFixture.create(settings);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest("echo", launchArguments, folder.path, { PATH: spaced }));
    const output = await ProgramFixture.readAllAsync(owned);

    Assert.areEqual(path.join(spaced, "echo.cmd"), owned.program);
    Assert.areEqual(JSON.stringify(launchArguments), output);
    Assert.isTrue((await owned.exited).isClean);
  }
}
