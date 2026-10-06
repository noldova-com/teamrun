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
export class MenuBarTemplateTests {
  @TestMethod
  public async buildsTheMacOSMenuBarFromItsWindowsMenusAndRunsTheChosenRowInThatWindow(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("darwin");
    const window = DesktopStartFixture.firstWindow(electron);
    const command = (id: string, label: string, key: string | null, enabled: boolean, check: string, checked: boolean): unknown =>
      ({ type: "Command", id, label, key, enabled, check, checked });

    electron.ipcMain.send("teamrun:menuBar", DesktopStartFixture.trustedEvent("darwin"), {
      menus: [
        { place: "shell.app", title: "TeamRun", rows: [command("shell.app/shell.settings/0", "Settings…", "Mod+Comma", true, "None", false)] },
        { place: "shell.file", title: "File", rows: [command("shell.file/notes.create/0", "New note", "Mod+Alt+N", true, "None", false)] },
        { place: "shell.edit", title: "Edit", rows: [] },
        { place: "shell.view", title: "View", rows: [command("shell.view/shell.docks/0", "Left dock", "Ctrl+Shift+F5", true, "Checkbox", true), { type: "Separator" }] },
        {
          place: "notes.tools", title: "Notes", rows: [
            command("notes.tools/notes.sorting/0", "Sort by title", null, false, "Radio", false),
            { type: "Submenu", label: "New from template", rows: [command("notes.tools/notes.more/0/notes.templates/notes.fromTemplate/0", "Plan", null, true, "None", false)] }
          ]
        },
        { place: "shell.empty", title: "Empty", rows: [] },
        { place: "shell.window", title: "Window", rows: [command("shell.window/notes.windows/0", "Notes window", null, true, "None", false)] },
        { place: "shell.help", title: "Help", rows: [command("shell.help/notes.help/0", "Notes help", null, true, "None", false)] }
      ]
    });
    const template = electron.menu.templates.at(-1) ?? [];
    const file = template[1]?.submenu;
    Assert.isTrue(Array.isArray(file));
    DesktopStartFixture.click(file[0]);
    electron.ipcMain.send("teamrun:menuBar", DesktopStartFixture.trustedEvent("darwin"), { menus: [{ place: "shell.edit", title: "Edit", rows: [command("shell.edit/notes.edit/0", "Tidy", null, true, "None", false)] }] });
    const edit = electron.menu.templates.at(-1)?.[1]?.submenu;

    Assert.areEqual(JSON.stringify([
      {
        label: template[0]?.label, submenu: [{ role: "about" }, { type: "separator" },
          { id: "shell.app/shell.settings/0", label: "Settings…", enabled: true, type: "normal", checked: false, accelerator: "Command+,", registerAccelerator: false },
          { type: "separator" }, { role: "services" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { role: "quit" }]
      },
      { label: "File", submenu: [{ id: "shell.file/notes.create/0", label: "New note", enabled: true, type: "normal", checked: false, accelerator: "Alt+Command+N", registerAccelerator: false }] },
      {
        label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "pasteAndMatchStyle" },
          { role: "delete" }, { role: "selectAll" }, { type: "separator" }, { label: "Speech", submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }] }]
      },
      { label: "View", submenu: [{ id: "shell.view/shell.docks/0", label: "Left dock", enabled: true, type: "checkbox", checked: true, accelerator: "Control+Shift+F5", registerAccelerator: false }, { type: "separator" }] },
      {
        label: "Notes", submenu: [
          { id: "notes.tools/notes.sorting/0", label: "Sort by title", enabled: false, type: "radio", checked: false },
          { label: "New from template", submenu: [{ id: "notes.tools/notes.more/0/notes.templates/notes.fromTemplate/0", label: "Plan", enabled: true, type: "normal", checked: false }] }
        ]
      },
      {
        label: "Window", role: "window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" },
          { role: "close", label: "Close Window", accelerator: "Command+Shift+W" }, { type: "separator" }, { role: "front" }, { type: "separator" },
          { id: "shell.window/notes.windows/0", label: "Notes window", enabled: true, type: "normal", checked: false }]
      },
      { label: "Help", submenu: [{ id: "shell.help/notes.help/0", label: "Notes help", enabled: true, type: "normal", checked: false }], role: "help" }
    ]), JSON.stringify(template));
    Assert.areEqual(JSON.stringify([["teamrun:menuCommand", "shell.file/notes.create/0"]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:menuCommand")));
    Assert.areEqual(13, Array.isArray(edit) ? edit.length : 0);
  }
}
