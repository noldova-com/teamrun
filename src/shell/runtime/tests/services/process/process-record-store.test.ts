/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProcessRecordStoreTests {
  @TestMethod
  public async renewsWhenItLastSawEachRunningProgramWhileItRuns(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.createSeeing(settings);
    const first = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    const second = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await Promise.all([ProgramFixture.readLineAsync(first), ProgramFixture.readLineAsync(second)]);

    await ProcessSupervisorFixture.waitForAsync(() => {
      const rows = settings.database.readAll(ProcessSupervisorFixture.SEEN);
      return rows.length === 2 && rows.every(t => Number(t["seen"]) > Number(t["started"]));
    });
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    Assert.areEqual("", settings.diagnostics.text);
  }

  @TestMethod
  public async reportsARunningProgramWhoseRecordItCannotRenew(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.createSeeing(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(owned);

    settings.database.run("DROP TABLE owned_processes");
    await ProcessSupervisorFixture.waitForAsync(() => settings.diagnostics.text.includes("no such table"));
    const text = settings.diagnostics.text;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await owned.exited;

    Assert.isTrue(text.startsWith(ProcessSupervisorFixture.line(owned, "").trimEnd()), text);
    Assert.isTrue(text.includes("no such table: owned_processes"), text);
  }
}
