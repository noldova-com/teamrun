/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class TrayMenuTemplateTests {
  @TestMethod
  public async listsFiveWorkRowsWithoutAMoreRowAndLeavesOutTheNotificationsWhenNoneIsUnread(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();

    fixture.send("work", { descriptions: ["One", "Two", "Three", "Four", "Five"], sequence: 1 });
    fixture.send("notifications", { notifications: [TrayFixture.notification(1, "Read", "clock", true)], quietDevices: [], mutedModules: [], sequence: 1 });

    Assert.areEqual(
      JSON.stringify(["One (disabled)", "Two (disabled)", "Three (disabled)", "Four (disabled)", "Five (disabled)", "-", "Open TeamRun", "Do not disturb [ ]", "-", "Quit TeamRun"]),
      JSON.stringify(fixture.rows));
  }

  @TestMethod
  public async putsEachTitleOnOneShortLineAndKeepsItsAmpersands(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const long = `Summarize ${"the release notes ".repeat(5)}`;

    fixture.send("work", { descriptions: [`Run\n  the   tests`, long], sequence: 1 });
    fixture.send("notifications", { notifications: [TrayFixture.notification(1, "Q&A & more")], quietDevices: [], mutedModules: [], sequence: 1 });

    const rows = fixture.rows;
    Assert.areEqual("Run the tests (disabled)", rows[0]);
    Assert.areEqual(`${long.slice(0, 59).trimEnd()}… (disabled)`, rows[1]);
    Assert.areEqual(60, (rows[1] ?? "").replace(" (disabled)", "").length);
    Assert.areEqual("Q&&A && more", rows[2]);
  }
}
