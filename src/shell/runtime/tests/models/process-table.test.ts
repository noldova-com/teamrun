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
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../fixtures/simulated-processes.fixture.js";
import { WindowsProcessApiFixture } from "../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessTableTests {
  @TestMethod
  public async endsWhatAGoneProgramStartedBeforeItWasLastSeenAndNamesWhatItStartedLaterOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.WINDOWS.now();
    settings.database.run(
      ProcessSupervisorFixture.INSERT, "notes", 900_601, "tool", "C:\\Tools\\tool.exe", ProcessSupervisorFixture.WINDOWS.boot, now - 10_000, now - 10_000, now - 5_000,
      ProcessSupervisorFixture.WINDOWS.offset());
    for (const processId of [900_602, 900_603, 900_604, 900_605])
      simulated.add(processId, 0);
    const windows = new WindowsProcessApiFixture([[
      `900602\t900601\t${now - 8_000}\tC:\\Tools\\child.exe`,
      `900603\t900602\t${now - 1_000}\tC:\\Tools\\grandchild.exe`,
      `900604\t900601\t${now - 4_949}\tC:\\Tools\\late.exe`,
      `900605\t900601\t${now - ProcessSupervisorFixture.HOUR}\tC:\\Windows\\explorer.exe`
    ].join("\n")]);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);

    await processes.cleanUpAsync();

    Assert.areEqual("900602 SIGKILL,900603 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_604) && simulated.isAlive(900_605));
    Assert.areEqual(
      "The module notes's program tool (process 900601): An earlier runtime left processes 900602, 900603 running, so they were ended.\n" +
      "The module notes's program tool (process 900601): It was no longer running, and nothing showed that processes 900604 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async boundsWhatAGoneProgramStartedByItsRequestAndWhenItWasLastSeenOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    const requested = now - 10_000;
    const seen = now - 5_000;
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_801, "tool", "C:\\Tools\\tool.exe", clock.boot, requested, requested + 5, seen, clock.offset());
    const children = new Map([[900_802, requested - 51], [900_803, requested - 50], [900_804, seen], [900_805, seen + 50], [900_806, seen + 51]]);
    for (const processId of children.keys())
      simulated.add(processId, 0);
    const windows = new WindowsProcessApiFixture([
      [...children].map(([processId, started]) => `${processId}\t900801\t${started}\tC:\\Tools\\child.exe`).join("\n")
    ]);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);

    await processes.cleanUpAsync();

    Assert.areEqual("900803 SIGKILL,900804 SIGKILL,900805 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_802) && simulated.isAlive(900_806));
    Assert.areEqual(
      "The module notes's program tool (process 900801): An earlier runtime left processes 900803, 900804, 900805 running, so they were ended.\n" +
      "The module notes's program tool (process 900801): It was no longer running, and nothing showed that processes 900806 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
