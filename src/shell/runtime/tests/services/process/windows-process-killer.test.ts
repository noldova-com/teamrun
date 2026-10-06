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
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class WindowsProcessKillerTests {
  @TestMethod
  public async closesAProgramsInputThenKillsWhatItStartedBeforeItExitedFromTheTopDownOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const program = await ProgramFixture.locateWindowsProgramAsync(folder.path);
    let leader = 0;
    let started = 0;
    const windows = new WindowsProcessApiFixture([
      () => [
        `${900_101}\t${leader}\t${started + 1}\t${program}`,
        `${900_102}\t${900_101}\t${started + 2}\t`,
        `${900_103}\t${leader}\t${started - ProcessSupervisorFixture.HOUR}\tC:\\old.exe`,
        `${900_104}\t${900_103}\t${started + 3}\tC:\\unrelated.exe`,
        `${900_105}\t${900_101}\t${started + 4}\tC:\\ended.exe`
      ].join("\n"),
      () => [
        `${900_101}\t${leader}\t${started + 1}\t${program}`,
        `${900_106}\t${900_101}\t${started + 5}\tC:\\late.exe`,
        `${900_107}\t${900_101}\t${started + 6}\tC:\\reused.exe`
      ].join("\n")
    ]);
    windows.replaced.set(900_107, WindowsProcessApiFixture.END);
    const command = new SystemCommandFixture([]);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows, command);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], undefined, program));
    leader = owned.processId;
    started = owned.started.getTime();
    simulated.own(leader);
    simulated.add(900_101, 0, true);
    simulated.add(900_102, 0);
    simulated.add(900_103, 0);
    simulated.add(900_104, 0);
    simulated.add(900_106, 0);
    simulated.add(900_107, 0);
    await ProgramFixture.readLineAsync(owned);

    const exit = await owned.stopAsync();

    Assert.isTrue(exit.isClean);
    Assert.areEqual(2, windows.listings);
    Assert.areEqual(0, command.calls.length);
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(
      [900_101, 900_102, 900_103, 900_104, 900_105, 900_101, 900_102, 900_105, 900_101, 900_106, 900_107, 900_106, 900_107].join(","),
      windows.opened.map(t => t.split(" ")[0]).join(","));
    Assert.areEqual("900101 SIGKILL,900102 SIGKILL,900106 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_103) && simulated.isAlive(900_104) && simulated.isAlive(900_107));
    Assert.areEqual(
      ProcessSupervisorFixture.line(owned, "It did not end within the grace period, so processes 900101, 900102, 900106 were ended forcefully.") +
      ProcessSupervisorFixture.line(owned, "Processes 900101 were still running after they were ended forcefully."),
      settings.diagnostics.text);
  }

  @TestMethod
  public async countsAProcessItMayNotOpenOrReadAsRunningAndSkipsOneThatIsGoneOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_861, "tool", "C:\\Tools\\tool.exe", clock.boot, now - 10_000, now - 10_000, now - 1_000, clock.offset());
    for (const processId of [900_862, 900_863, 900_864])
      simulated.add(processId, 0);
    const windows = new WindowsProcessApiFixture([[
      `900862\t900861\t${now - 5_000}\tC:\\Tools\\denied.exe`,
      `900863\t900861\t${now - 5_000}\tC:\\Tools\\unreadable.exe`,
      `900864\t900861\t${now - 5_000}\tC:\\Tools\\child.exe`,
      `900865\t900861\t${now - 5_000}\tC:\\Tools\\gone.exe`
    ].join("\n")]);
    windows.denied.set(900_862, WindowsProcessApiFixture.END);
    windows.unreadable.set(900_863, WindowsProcessApiFixture.END);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);

    await processes.cleanUpAsync();

    Assert.areEqual("900864 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_862) && simulated.isAlive(900_863));
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(
      "The module notes's program tool (process 900861): An earlier runtime left processes 900864 running, so they were ended.\n" +
      "The module notes's program tool (process 900861): Processes 900862, 900863 were still running after they were ended forcefully.\n",
      settings.diagnostics.text);
  }
}
