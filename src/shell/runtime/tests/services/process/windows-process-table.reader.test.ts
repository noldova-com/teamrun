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
export class WindowsProcessTableReaderTests {
  @TestMethod
  public async reportsATableRowItCannotReadAndKeepsTheLeftoversOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const clock = ProcessSupervisorFixture.WINDOWS;
    const now = clock.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_401, "tool", "C:\\tool.exe", clock.boot, now, now, now, clock.offset());
    settings.database.run(ProcessSupervisorFixture.INSERT, "tasks", 900_402, "tool", "C:\\tool.exe", clock.boot, now, now, now, clock.offset());
    const unreadable = ProcessSupervisorFixture.createWindows(settings, { SystemRoot: "C:\\Windows" }, new SystemCommandFixture(["900401\tnot a row"]));

    await unreadable.cleanUpAsync();

    Assert.isTrue(settings.diagnostics.text.includes("The process table has a row that could not be read: 900401\tnot a row"), settings.diagnostics.text);
    Assert.areEqual(2, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
