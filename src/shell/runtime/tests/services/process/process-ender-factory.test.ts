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
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessEnderFactoryTests {
  @TestMethod
  public async readsTheProcessTableWithPsOnPosixAndTheSystemsOwnFunctionsOnWindows(): Promise<void> {
    await using linuxSettings = await SettingsFixture.createAsync();
    await using windowsSettings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_951, 900_951);
    const linuxNow = ProcessSupervisorFixture.LINUX.now();
    const windowsNow = ProcessSupervisorFixture.WINDOWS.now();
    linuxSettings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_951, "tool", "/usr/bin/tool", ProcessSupervisorFixture.LINUX.boot, linuxNow, linuxNow, linuxNow, 0);
    windowsSettings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_952, "tool", "C:\\Tools\\tool.exe", ProcessSupervisorFixture.WINDOWS.boot, windowsNow, windowsNow, windowsNow,
      ProcessSupervisorFixture.WINDOWS.offset());
    const linuxCommand = new SystemCommandFixture([new Error("ps failed.")]);
    const windowsCommand = new SystemCommandFixture([]);
    const windows = new WindowsProcessApiFixture([new Error("The process snapshot failed with Windows error 8.")]);

    await ProcessSupervisorFixture.createLinux(linuxSettings, linuxCommand).cleanUpAsync();
    await ProcessSupervisorFixture.createWindows(windowsSettings, windows, windowsCommand).cleanUpAsync();

    Assert.areEqual("/bin/ps", linuxCommand.calls[0]?.[0]);
    Assert.areEqual(1, windows.listings);
    Assert.areEqual(0, windowsCommand.calls.length);
  }
}
