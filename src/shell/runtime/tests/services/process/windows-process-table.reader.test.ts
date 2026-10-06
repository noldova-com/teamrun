/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { ProcessClockFixture } from "../../fixtures/process-clock.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class WindowsProcessTableReaderTests {
  @TestMethod
  public async leavesOutWhatItCannotOpenOrReadAndWhatStartedAfterTheListAndClosesEveryHandleOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_401, "tool", "C:\\Tools\\tool.exe", clock.boot, now - 10_000, now - 10_000, now - 1_000, clock.offset());
    for (const processId of [900_402, 900_403, 900_404, 900_405])
      simulated.add(processId, 0);
    const windows = new WindowsProcessApiFixture([[
      `900402\t900401\t${now - 5_000}\tC:\\Tools\\denied.exe`,
      `900403\t900401\t${now - 5_000}\tC:\\Tools\\unreadable.exe`,
      `900404\t900401\t${now + ProcessSupervisorFixture.HOUR}\tC:\\Tools\\reused.exe`,
      `900405\t900401\t${now - 5_000}\t`
    ].join("\n")]);
    windows.denied.set(900_402, WindowsProcessApiFixture.QUERY);
    windows.unreadable.set(900_403, WindowsProcessApiFixture.QUERY);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);

    await processes.cleanUpAsync();

    Assert.areEqual("900405 SIGKILL", simulated.signals.join(","));
    Assert.isTrue([900_402, 900_403, 900_404].every(t => simulated.isAlive(t)));
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(
      `900402 ${WindowsProcessApiFixture.QUERY},900403 ${WindowsProcessApiFixture.QUERY},900404 ${WindowsProcessApiFixture.QUERY},900405 ${WindowsProcessApiFixture.QUERY}`,
      windows.opened.slice(0, 4).join(","));
    Assert.areEqual("The module notes's program tool (process 900401): An earlier runtime left processes 900405 running, so they were ended.\n", settings.diagnostics.text);
  }

  @TestMethod
  public async leavesOutAProcessCreatedAfterItReadTheClockEvenWhenTheListEndsLaterOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = 1_000_000;
    const clock = new ProcessClockFixture(now);
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_401, "tool", "C:\\Tools\\tool.exe", clock.boot, now - 10_000, now - 10_000, now - 1_000, clock.offset());
    simulated.add(900_402, 0);
    const windows = new WindowsProcessApiFixture([() => {
      clock.time = now + 10;
      return `900402\t900401\t${now + 5}\tC:\\Tools\\reused.exe`;
    }]);
    const processes = ProcessSupervisorFixture.create(settings, "win32", { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, new SystemCommandFixture([]), clock, windows);

    await processes.cleanUpAsync();

    Assert.areEqual("", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_402));
    Assert.areEqual(0, windows.openHandles);
  }
}
