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

@TestClass
export class ProcessEnderFactoryTests {
  @TestMethod
  public async readsTheProcessTableWithItsPlatformsOwnTool(): Promise<void> {
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
    const windowsCommand = new SystemCommandFixture([new Error("PowerShell failed.")]);

    await ProcessSupervisorFixture.createLinux(linuxSettings, linuxCommand).cleanUpAsync();
    await ProcessSupervisorFixture.createWindows(windowsSettings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, windowsCommand).cleanUpAsync();

    Assert.areEqual("/bin/ps", linuxCommand.calls[0]?.[0]);
    Assert.isTrue(String(windowsCommand.calls[0]?.[0]).toLowerCase().endsWith("powershell.exe"), String(windowsCommand.calls[0]?.[0]));
  }
}
