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
export class MenuBarRowTests {
  @TestMethod
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"button\"}]}]}", "$: The menu bar is not valid.")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"Command\",\"id\":\"a\",\"label\":\"A\",\"key\":null,\"enabled\":true,\"check\":\"Toggle\",\"checked\":false}]}]}", "$: The menu bar is not valid.")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"Command\",\"id\":\"a\",\"label\":\"A\",\"key\":\"Mod+Nope\",\"enabled\":true,\"check\":\"None\",\"checked\":false}]}]}", "Mod+Nope")
  public refusesARowOfAnUnknownTypeCheckOrKey(menuBar: string, reason: string): Promise<void> {
    return DesktopStartFixture.verifyMenuBarRefusedAsync(menuBar, reason);
  }
}
