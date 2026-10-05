/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";

@TestClass
export class MenuBarMenuTests {
  @TestMethod
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"rows\":[]}]}", "$.title: ")
  @TestData("{\"menus\":[{\"title\":\"File\",\"rows\":[]}]}", "$.place: ")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\"}]}", "$.rows: ")
  public refusesAMenuWithoutItsPlaceTitleOrRows(menuBar: string, reason: string): Promise<void> {
    return DesktopStartFixture.verifyMenuBarRefusedAsync(menuBar, reason);
  }
}
