/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../fixtures/program.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";
import { WindowsProcessApiFixture } from "../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessEndingTests {
  @TestMethod
  public async killsTheGroupThatOutlastsAnErrorExitAndReportsWhatStaysOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve([
      simulated.list(t => `  ${t} ${leader} ${leader} 00:00`),
      `${leader + 1} 1 1 1-00:00:00`,
      `${leader + 2} 1 1 01:02:03`,
      "",
      `${leader + 3} 1 1 00:01`
    ].join("\n"));
    const processes = ProcessSupervisorFixture.createLinux(settings, new SystemCommandFixture([rows]));

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "2"]));
    leader = owned.processId;
    simulated.add(900_001, leader, true);
    await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`-${leader} SIGTERM,-${leader} SIGKILL`, simulated.signals.join(","));
    Assert.areEqual(
      ProcessSupervisorFixture.line(owned, "It did not end within the grace period, so processes 900001 were ended forcefully.") +
      ProcessSupervisorFixture.line(owned, "Processes 900001 were still running after they were ended forcefully."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async reportsAnEndingItCannotReadAndKeepsTheRecordOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    let leader = 0;
    const windows = new WindowsProcessApiFixture([
      () => `900841\t${leader}\t${ProcessSupervisorFixture.readStarted(settings) + 1}\tC:\\child.exe`,
      new Error("The process snapshot failed with Windows error 8.")
    ]);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    leader = owned.processId;
    await ProgramFixture.readLineAsync(owned);

    const exit = await owned.stopAsync();

    const text = settings.diagnostics.text;
    Assert.isTrue(exit.isClean);
    Assert.isTrue(text.startsWith(ProcessSupervisorFixture.line(owned, "").trimEnd()), text);
    Assert.isTrue(text.includes("The process snapshot failed with Windows error 8."), text);
    Assert.areEqual(String(leader), settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }
}
