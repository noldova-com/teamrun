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
  public async reportsAMissingSystemRootAndKeepsTheLeftoversOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_401, "tool", "C:\\tool.exe", clock.boot, now, now, now, clock.offset());
    settings.database.run(ProcessSupervisorFixture.INSERT, "tasks", 900_402, "tool", "C:\\tool.exe", clock.boot, now, now, now, clock.offset());
    const missingRoot = ProcessSupervisorFixture.createWindows(settings, {}, new SystemCommandFixture([]));

    await missingRoot.cleanUpAsync();

    Assert.isTrue(settings.diagnostics.text.startsWith("The module notes's program tool (process 900401): "), settings.diagnostics.text);
    Assert.isTrue(settings.diagnostics.text.includes("The module tasks's program tool (process 900402): "), settings.diagnostics.text);
    Assert.isTrue(settings.diagnostics.text.includes("SystemRoot is not set, so the Windows system tools cannot be found."), settings.diagnostics.text);
    Assert.areEqual(2, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
