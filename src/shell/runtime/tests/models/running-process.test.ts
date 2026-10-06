/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { ProcessClockFixture } from "../fixtures/process-clock.fixture.js";
import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../fixtures/program.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";
import { WindowsProcessApiFixture } from "../fixtures/windows-process-api.fixture.js";

@TestClass
export class RunningProcessTests {
  @TestMethod
  public async boundsWhatAProgramThatExitedDuringTheGracePeriodStartedByWhenItExitedOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    const clock = new ProcessClockFixture(1_000_000);
    let leader = 0;
    const windows = new WindowsProcessApiFixture([
      () => {
        clock.time = 1_010_000 + ProcessSupervisorFixture.HOUR;
        return [
          `900831\t${leader}\t${1_009_000}\tC:\\Tools\\child.exe`,
          `900832\t${leader}\t${1_010_051}\tC:\\Other\\child.exe`,
          `900833\t${leader}\t${1_010_000 + ProcessSupervisorFixture.HOUR - 1}\tC:\\Other\\child.exe`
        ].join("\n");
      }
    ]);
    const processes = ProcessSupervisorFixture.create(settings, "win32", { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, new SystemCommandFixture([]), clock, windows);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    leader = owned.processId;
    for (const processId of [900_831, 900_832, 900_833])
      simulated.add(processId, 0);
    await ProgramFixture.readLineAsync(owned);
    clock.time = 1_010_000;

    const exit = await owned.stopAsync();

    Assert.isTrue(exit.isClean);
    Assert.areEqual("900831 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_832) && simulated.isAlive(900_833));
    Assert.areEqual(ProcessSupervisorFixture.line(owned, "It did not end within the grace period, so processes 900831 were ended forcefully."), settings.diagnostics.text);
  }
}
