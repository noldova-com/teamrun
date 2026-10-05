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
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"button\"}]}]}")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"command\",\"id\":\"a\",\"label\":\"A\",\"key\":null,\"enabled\":true,\"check\":\"Toggle\",\"checked\":false}]}]}")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"command\",\"id\":\"a\",\"label\":\"A\",\"key\":\"Mod+Nope\",\"enabled\":true,\"check\":\"None\",\"checked\":false}]}]}")
  public refusesARowOfAnUnknownTypeCheckOrKey(menuBar: string): Promise<void> {
    return DesktopStartFixture.verifyMenuBarRefusedAsync(menuBar);
  }
}
