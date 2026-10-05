/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../fixtures/program.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";

@TestClass
export class KeptProgramTests {
  @TestMethod
  @PlatformFixture.posixOnly()
  public async leavesAProgramsGroupAfterACleanExitUntilItsModuleStops(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, "0"]));
    const child = Number(await ProgramFixture.readLineAsync(owned));

    await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const keptAfterExit = ProgramFixture.isRunning(child);
    const listedAfterExit = processes.programs.map(t => `${t.processId} ${t.hasExited}`);
    const recordedAfterExit = settings.database.readAll(ProcessSupervisorFixture.RECORDS).length;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.isTrue(keptAfterExit);
    Assert.areEqual(`${owned.processId} true`, listedAfterExit.join(","));
    Assert.areEqual(1, recordedAfterExit);
    Assert.isTrue(await ProgramFixture.waitForEndAsync(child, 1_000));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    Assert.areEqual("", settings.diagnostics.text);
  }
}
