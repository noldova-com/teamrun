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
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";

@TestClass
export class WindowsPowerShellTests {
  @TestMethod
  public async logsATableReadThatFailsAndKeepsTheRecordsOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_901, "tool", "C:\\Tools\\tool.exe", clock.boot, now, now, now, clock.offset());
    const command = new SystemCommandFixture([new Error("Get-WmiObject : The RPC server is unavailable.")]);
    const processes = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, command);

    await processes.cleanUpAsync();

    Assert.areEqual(1, command.calls.length);
    Assert.isTrue(settings.diagnostics.text.startsWith("The module notes's program tool (process 900901): Error: Get-WmiObject : The RPC server is unavailable."), settings.diagnostics.text);
    Assert.areEqual(1, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
