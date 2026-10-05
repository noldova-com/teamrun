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
export class MenuBarTests {
  @TestMethod
  @TestData("{}", "$.menus: ")
  @TestData("{\"menus\":\"File\"}", "$.menus: ")
  @TestData("[]", "$: ")
  public refusesAMenuBarWithoutItsMenus(menuBar: string, reason: string): Promise<void> {
    return DesktopStartFixture.verifyMenuBarRefusedAsync(menuBar, reason);
  }
}
