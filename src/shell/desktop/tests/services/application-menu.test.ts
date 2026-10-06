/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";

@TestClass
export class ApplicationMenuTests {
  @TestMethod
  public async setsTheStandardMenuOnlyOnMacOSLeavingCommandWToTheWindow(): Promise<void> {
    const windows = await DesktopStartFixture.startReadyAsync("win32");
    const mac = await DesktopStartFixture.startReadyAsync("darwin");
    const [app] = mac.menu.templates.find(t => t === mac.menu.menu) ?? [];

    Assert.isNull(windows.menu.menu);
    Assert.areEqual(JSON.stringify([
      {
        label: app?.label, submenu: [{ role: "about" }, { type: "separator" }, { role: "services" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" },
          { role: "unhide" }, { type: "separator" }, { role: "quit" }]
      },
      {
        label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "pasteAndMatchStyle" },
          { role: "delete" }, { role: "selectAll" }, { type: "separator" }, { label: "Speech", submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }] }]
      },
      {
        label: "Window", role: "window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" },
          { role: "close", label: "Close Window", accelerator: "Command+Shift+W" }, { type: "separator" }, { role: "front" }]
      }
    ]), JSON.stringify(mac.menu.menu));
  }
}
