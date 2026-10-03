/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { MenuItemConstructorOptions } from "electron";

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Event, Failure, FailureCode, NotificationBroadcast, PreShellData, QualifiedName, Response, RuntimeHandover, ShellEvents } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, DataDirectoryLocator, type LaunchSettings, PreShellDataFoundException, RuntimeBuild, RuntimeEntry, RuntimeHandoverException } from "@noldova/teamrun-shell-runtime";
import { DesktopApplication, DesktopSettings, DeviceIdentity, type IIpcEvent } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeAppearanceStore } from "../fixtures/fake-appearance-store.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeDockHost } from "../fixtures/fake-dock-host.fixture.js";
import type { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class DesktopApplicationTests {
  private static readonly NOTIFICATION_METHODS: readonly string[] = [
    "shell.notifications", "shell.postNotification", "shell.updateNotification", "shell.dismissNotification", "shell.markNotificationsRead", "shell.clearNotifications"
  ];

  private static readonly MODULE_URL: string = pathToFileURL("/teamrun/node_modules/@noldova/teamrun-shell-desktop/main.js").href;
  private static readonly DEVELOPMENT_APP_ID: string = `com.noldova.teamrun.development.${createHash("sha256")
    .update(resolve(dirname(fileURLToPath(DesktopApplicationTests.MODULE_URL)), "..", "..", ".."))
    .digest("hex")
    .slice(0, 8)}`;
  private static readonly APPEARANCE: object = { background: "#181818", titleBar: "#181818", titleBarText: "#CCCCCC", titleBarHeight: 35 };

  @TestMethod
  public namesItselfAndKeepsOneInstanceInTheSandbox(): void {
    const electron = new FakeElectron();

    DesktopApplicationTests.start(electron, new FakeDesktopProcess("win32"));

    Assert.areEqual(
      JSON.stringify(["setName TeamRun", `setAppUserModelId ${DesktopApplicationTests.DEVELOPMENT_APP_ID}`, "requestSingleInstanceLock", "enableSandbox"]),
      JSON.stringify(electron.app.calls.slice(1)));
    Assert.areEqual(0, electron.windows.length);
  }

  @TestMethod
  public async quitsWhenAnotherInstanceRuns(): Promise<void> {
    const electron = new FakeElectron(false);

    DesktopApplicationTests.start(electron, new FakeDesktopProcess("win32"));
    await electron.app.becomeReadyAsync();

    Assert.areEqual(
      JSON.stringify(["setName TeamRun", `setAppUserModelId ${DesktopApplicationTests.DEVELOPMENT_APP_ID}`, "requestSingleInstanceLock", "quit"]), JSON.stringify(electron.app.calls.slice(1)));
    Assert.areEqual(0, electron.app.count("window-all-closed"));
    Assert.areEqual(0, electron.windows.length);
  }

  @TestMethod
  public opensAHiddenSecureWindowWithTheTitleBarOverlayOnWindowsAndLinux(): Promise<void> {
    return DesktopApplicationTests.verifyWindowAsync("linux", window => {
      Assert.isTrue(window.options.titleBarOverlay === true);
      Assert.isUndefined(window.options.trafficLightPosition);
    });
  }

  @TestMethod
  public describesItsWindowsToTheWindowsTaskbarAsThisBuild(): Promise<void> {
    const data = resolve("data");
    const packaged = new FakeElectron(true, true);
    DesktopApplicationTests.start(packaged, new FakeDesktopProcess("win32", [`--data-dir=${data}`]));
    const development = new FakeElectron();
    DesktopApplicationTests.start(development, new FakeDesktopProcess("win32"));
    const linux = new FakeElectron();
    DesktopApplicationTests.start(linux, new FakeDesktopProcess("linux"));
    return Promise.all([packaged.app.becomeReadyAsync(), development.app.becomeReadyAsync(), linux.app.becomeReadyAsync()]).then(() => {
      const mainScript = resolve(fileURLToPath(DesktopApplicationTests.MODULE_URL));

      Assert.areEqual(`"/electron/electron" "--data-dir=${data}"`, DesktopApplicationTests.firstWindow(packaged).appDetails?.relaunchCommand);
      Assert.areEqual("com.noldova.teamrun", DesktopApplicationTests.firstWindow(packaged).appDetails?.appId);
      Assert.areEqual(`"/electron/electron" "${mainScript}"`, DesktopApplicationTests.firstWindow(development).appDetails?.relaunchCommand);
      Assert.areEqual(DesktopApplicationTests.DEVELOPMENT_APP_ID, DesktopApplicationTests.firstWindow(development).appDetails?.appId);
      Assert.isNull(DesktopApplicationTests.firstWindow(linux).appDetails);
    });
  }

  @TestMethod
  @TestData("win32", "icon-dark.ico")
  @TestData("linux", "icon-dark-512.png")
  public givesItsWindowTheOneOutlinedIconWhateverTheSystemsAppearance(platform: string, icon: string): Promise<void> {
    return DesktopApplicationTests.startReadyAsync(platform).then(electron => {
      const window = DesktopApplicationTests.firstWindow(electron);

      Assert.areEqual(DesktopApplicationTests.icon(icon), window.options.icon);
      Assert.areEqual(platform === "win32" ? DesktopApplicationTests.icon(icon) : undefined, window.appDetails?.appIconPath);
    });
  }

  @TestMethod
  public showsItsIconInTheDockOnMacOSAndLeavesTheWindowsIconToTheBundle(): Promise<void> {
    const electron = new FakeElectron();
    const dock = new FakeDockHost();
    electron.app.dock = dock;

    return DesktopApplicationTests.startReadyAsync("darwin", undefined, electron).then(() => {
      Assert.areEqual(JSON.stringify([DesktopApplicationTests.icon("icon-dock-512.png")]), JSON.stringify(dock.icons));
      Assert.isUndefined(DesktopApplicationTests.firstWindow(electron).options.icon);
    });
  }

  @TestMethod
  public opensAHiddenSecureWindowWithTrafficLightsOnMacOS(): Promise<void> {
    return DesktopApplicationTests.verifyWindowAsync("darwin", window => {
      Assert.isUndefined(window.options.titleBarOverlay);
      Assert.areEqual(JSON.stringify({ x: 12, y: 10 }), JSON.stringify(window.options.trafficLightPosition));
    });
  }

  @TestMethod
  public async setsTheStandardMenuOnlyOnMacOSLeavingCommandWToTheWindow(): Promise<void> {
    const windows = await DesktopApplicationTests.startReadyAsync("win32");
    const mac = await DesktopApplicationTests.startReadyAsync("darwin");
    const [app] = mac.menu.templates.at(-1) ?? [];

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

  @TestMethod
  public async deniesEveryPermission(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");

    Assert.isTrue(electron.permissions.request("media") === false);
    Assert.isTrue(electron.permissions.check() === false);
  }

  @TestMethod
  public async keepsTheWindowOnItsOwnPage(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const contents = DesktopApplicationTests.firstWindow(electron).webContents;
    const windowUrl = DesktopApplicationTests.settings("linux").windowUrl;

    Assert.isTrue(contents.navigate("will-navigate", "https://example.com/"));
    Assert.isFalse(contents.navigate("will-navigate", `${windowUrl}#settings`));
    Assert.isTrue(contents.navigate("will-redirect", "https://example.com/"));
    Assert.isFalse(contents.navigate("will-redirect", windowUrl));
    Assert.isTrue(contents.navigate("will-attach-webview"));
    Assert.areEqual(JSON.stringify({ action: "deny" }), JSON.stringify(contents.openWindow()));
  }

  @TestMethod
  @TestData("linux", "{\"color\":\"#181818\",\"symbolColor\":\"#CCCCCC\",\"height\":35}")
  @TestData("darwin", "null")
  public async showsTheWindowInTheAppearanceItsPageReports(platform: string, overlay: string): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync(platform);
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent(platform), DesktopApplicationTests.APPEARANCE);
    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent(platform), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.areEqual(overlay, JSON.stringify(window.overlay));
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async showsTheWindowWithoutAnAppearanceItCannotUse(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), { background: "red" });
    await Condition.waitAsync(() => window.isShown);

    Assert.isNull(window.backgroundColor);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify(["The window reported an appearance that is not valid, so it is shown without it: JsonException: $.titleBar: The field is required."]),
      JSON.stringify(DesktopApplicationTests.readErrors(process, "The window reported")));
  }

  @TestMethod
  @TestData("linux", "{\"color\":\"#FFFFFF\",\"symbolColor\":\"#111111\",\"height\":35}")
  @TestData("win32", "{\"color\":\"#FFFFFF\",\"symbolColor\":\"#111111\",\"height\":35}")
  @TestData("darwin", "null")
  public async paintsTheWindowAgainWhenItsPageReportsAChangedAppearanceWithoutShowingItAgain(platform: string, overlay: string): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync(platform);
    const window = DesktopApplicationTests.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent(platform), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    electron.ipcMain.send("teamrun:appearance", DesktopApplicationTests.trustedEvent(platform),
      { background: "#FFFFFF", titleBar: "#FFFFFF", titleBarText: "#111111", titleBarHeight: 35 });

    Assert.areEqual("#FFFFFF", window.backgroundColor);
    Assert.areEqual(overlay, JSON.stringify(window.overlay));
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async buildsTheMacOSMenuBarFromItsWindowsMenusAndRunsTheChosenRowInThatWindow(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("darwin");
    const window = DesktopApplicationTests.firstWindow(electron);
    const command = (id: string, label: string, key: string | null, enabled: boolean, check: string, checked: boolean): unknown =>
      ({ type: "command", id, label, key, enabled, check, checked });

    electron.ipcMain.send("teamrun:menuBar", DesktopApplicationTests.trustedEvent("darwin"), {
      menus: [
        { place: "shell.app", title: "TeamRun", rows: [command("shell.app/shell.settings/0", "Settings…", "Mod+Comma", true, "None", false)] },
        { place: "shell.file", title: "File", rows: [command("shell.file/notes.create/0", "New note", "Mod+Alt+N", true, "None", false)] },
        { place: "shell.edit", title: "Edit", rows: [] },
        { place: "shell.view", title: "View", rows: [command("shell.view/shell.docks/0", "Left dock", "Ctrl+Shift+F5", true, "Checkbox", true), { type: "separator" }] },
        {
          place: "notes.tools", title: "Notes", rows: [
            command("notes.tools/notes.sorting/0", "Sort by title", null, false, "Radio", false),
            { type: "submenu", label: "New from template", rows: [command("notes.tools/notes.more/0/notes.templates/notes.fromTemplate/0", "Plan", null, true, "None", false)] }
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
    DesktopApplicationTests.click(file[0]);
    electron.ipcMain.send("teamrun:menuBar", DesktopApplicationTests.trustedEvent("darwin"), { menus: [{ place: "shell.edit", title: "Edit", rows: [command("shell.edit/notes.edit/0", "Tidy", null, true, "None", false)] }] });
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

  @TestMethod
  public async runsNoMenuRowOnceItsWindowHasClosed(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("darwin");
    const window = DesktopApplicationTests.firstWindow(electron);
    electron.ipcMain.send("teamrun:menuBar", DesktopApplicationTests.trustedEvent("darwin"),
      { menus: [{ place: "shell.file", title: "File", rows: [{ type: "command", id: "shell.file/shell.close/0", label: "Close the tab", key: null, enabled: true, check: "None", checked: false }] }] });
    const file = electron.menu.templates.at(-1)?.[1]?.submenu;

    window.destroy();
    Assert.isTrue(Array.isArray(file));
    DesktopApplicationTests.click(file[0]);

    Assert.areEqual(0, window.webContents.sent.filter(t => t[0] === "teamrun:menuCommand").length);
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("win32", true)
  @TestData("darwin", false)
  public async leavesTheMenuBarAloneOnWindowsAndLinuxAndForAnotherSender(platform: string, isTrusted: boolean): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync(platform);
    const built = electron.menu.templates.length;

    electron.ipcMain.send("teamrun:menuBar", isTrusted ? DesktopApplicationTests.trustedEvent(platform) : { sender: { id: 1 }, senderFrame: null }, { menus: [] });

    Assert.areEqual(built, electron.menu.templates.length);
  }

  @TestMethod
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"button\"}]}]}")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"command\",\"id\":\"a\",\"label\":\"A\",\"key\":null,\"enabled\":true,\"check\":\"Toggle\",\"checked\":false}]}]}")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"rows\":[]}]}")
  @TestData("{\"menus\":[{\"place\":\"shell.file\",\"title\":\"File\",\"rows\":[{\"type\":\"command\",\"id\":\"a\",\"label\":\"A\",\"key\":\"Mod+Nope\",\"enabled\":true,\"check\":\"None\",\"checked\":false}]}]}")
  public async keepsTheMenuBarWhenItsWindowSendsOneThatIsNotValid(menuBar: string): Promise<void> {
    const process = new FakeDesktopProcess("darwin");
    const electron = await DesktopApplicationTests.startReadyAsync("darwin", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const built = electron.menu.templates.length;

    electron.ipcMain.send("teamrun:menuBar", DesktopApplicationTests.trustedEvent("darwin"), JSON.parse(menuBar));

    Assert.areEqual(built, electron.menu.templates.length);
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "The window sent a menu bar that is not valid, so the menu bar is unchanged: ").length);
  }

  @TestMethod
  public async keepsTheWindowHiddenWhenAChangedAppearanceComesBeforeTheFirstOne(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.ipcMain.send("teamrun:appearance", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.isFalse(window.isShown);
  }

  @TestMethod
  public async keepsTheWindowsColorsWhenAChangedAppearanceCannotBeUsed(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);

    electron.ipcMain.send("teamrun:appearance", DesktopApplicationTests.trustedEvent("linux"), { background: "red" });

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "The window reported").length);
  }

  @TestMethod
  public async ignoresMessagesFromFramesItDoesNotTrust(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);
    const windowUrl = DesktopApplicationTests.settings("linux").windowUrl;
    const untrusted: IIpcEvent[] = [
      { sender: { id: 1 }, senderFrame: null },
      { sender: { id: 1 }, senderFrame: { url: windowUrl, parent: {} } },
      { sender: { id: 1 }, senderFrame: { url: "https://example.com/", parent: null } },
      { sender: { id: 7 }, senderFrame: { url: windowUrl, parent: null } }
    ];

    for (const event of untrusted) {
      electron.ipcMain.send("teamrun:ready", event, DesktopApplicationTests.APPEARANCE);
      electron.ipcMain.send("teamrun:appearance", event, DesktopApplicationTests.APPEARANCE);
      Assert.isFalse(electron.ipcMain.invoke("teamrun:closeAnswer", event, "request", true) === true);
    }

    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.isNull(window.backgroundColor);
  }

  @TestMethod
  public async closesOnlyAfterThePageSaysItSaved(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    window.close();
    window.close();
    const [request] = DesktopApplicationTests.closeRequests(window);

    Assert.areEqual(1, DesktopApplicationTests.closeRequests(window).length);
    Assert.areEqual("teamrun:closeRequest", request?.[0]);
    Assert.isFalse(window.isGone);
    Assert.isTrue(electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), request?.[1], true) === true);
    await Condition.waitAsync(() => window.isGone);
  }

  @TestMethod
  public async staysOpenWhenThePageKeepsUnsavedWork(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], false);
    await setImmediate();
    window.close();

    Assert.isFalse(window.isGone);
    Assert.areEqual(2, DesktopApplicationTests.closeRequests(window).length);
    window.destroy();
  }

  @TestMethod
  public async stopsWaitingForAWindowThatIsGone(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    window.close();
    window.destroy();
    await setImmediate();

    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async sendsNoCloseRequestToAWindowThatIsGone(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    window.isGone = true;
    window.close();
    await setImmediate();

    Assert.areEqual(0, DesktopApplicationTests.closeRequests(window).length);
    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async quitsWhenTheLastWindowCloses(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");

    electron.app.emit("window-all-closed");

    Assert.areEqual("quit", electron.app.calls.at(-1));
  }

  @TestMethod
  public async bringsItsWindowForwardWhenStartedAgain(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.app.emit("second-instance");
    window.isMinimizedNow = true;
    electron.app.emit("second-instance");

    Assert.areEqual(JSON.stringify(["focus", "restore", "focus"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async opensItsWindowWithTheDevicesLastAppearanceAndKeepsTheOneItsWindowReports(): Promise<void> {
    const appearance = new FakeAppearanceStore();
    appearance.kept = { "shell.mode": "Dark" };
    const process = new FakeDesktopProcess("darwin", ["--device-dir=/devices/this"]);
    const electron = await DesktopApplicationTests.startReadyAsync("darwin", undefined, undefined, undefined, process, appearance);
    const event = DesktopApplicationTests.trustedEvent("darwin");

    electron.ipcMain.send("teamrun:keepAppearance", { sender: { id: 1 }, senderFrame: null }, { "shell.mode": "System" });
    electron.ipcMain.send("teamrun:keepAppearance", event, ["shell.mode"]);
    electron.ipcMain.send("teamrun:keepAppearance", event, { "shell.theme": "x".repeat(4100) });
    electron.ipcMain.send("teamrun:keepAppearance", event, { "shell.mode": "Light" });
    DesktopApplicationTests.firstWindow(electron).destroy();
    electron.app.emit("activate");

    Assert.areEqual(JSON.stringify(["/devices/this"]), JSON.stringify(appearance.folders));
    Assert.areEqual(JSON.stringify(["--teamrun-appearance={\"shell.mode\":\"Dark\"}"]), JSON.stringify(electron.windows[0]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify([{ "shell.mode": "Light" }]), JSON.stringify(appearance.writes));
    Assert.areEqual(JSON.stringify(["--teamrun-appearance={\"shell.mode\":\"Light\"}"]), JSON.stringify(electron.windows[1]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(2, DesktopApplicationTests.readErrors(process, "The window's appearance preferences are not valid, so they are not kept").length);
  }

  @TestMethod
  public async opensItsWindowInTheDefaultAppearanceWhenTheLastOneCannotBeReadAndReportsOneItCannotKeep(): Promise<void> {
    const appearance = new FakeAppearanceStore();
    appearance.readFailure = new SyntaxError("Unexpected end of JSON input");
    appearance.writeFailure = new Error("The disk is full.");
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", undefined, undefined, undefined, process, appearance);

    electron.ipcMain.send("teamrun:keepAppearance", DesktopApplicationTests.trustedEvent("linux"), { "shell.mode": "Dark" });
    await Condition.waitAsync(() => DesktopApplicationTests.readErrors(process, "The device's appearance could not be kept").length > 0);

    Assert.areEqual(JSON.stringify([]), JSON.stringify(DesktopApplicationTests.firstWindow(electron).options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify(["The device's last appearance could not be read, so the window starts in the default appearance: SyntaxError: Unexpected end of JSON input"]),
      JSON.stringify(DesktopApplicationTests.readErrors(process, "The device's last appearance")));
    Assert.areEqual(JSON.stringify(["The device's appearance could not be kept for the next start: Error: The disk is full."]),
      JSON.stringify(DesktopApplicationTests.readErrors(process, "The device's appearance could not be kept")));
  }

  @TestMethod
  public async opensAWindowWhenActivatedWithoutOne(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("darwin");

    electron.app.emit("activate");
    Assert.areEqual(1, electron.windows.length);
    DesktopApplicationTests.firstWindow(electron).destroy();
    electron.app.emit("second-instance");
    electron.app.emit("activate");

    Assert.areEqual(2, electron.windows.length);
  }

  private static async verifyWindowAsync(platform: string, verifyTitleBar: (window: FakeDesktopWindow) => void): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync(platform);
    const window = DesktopApplicationTests.firstWindow(electron);
    const settings = DesktopApplicationTests.settings(platform);

    Assert.areEqual(1, electron.windows.length);
    Assert.areEqual(JSON.stringify({
      width: 1280,
      height: 800,
      minWidth: 640,
      minHeight: 400,
      show: false,
      title: "TeamRun",
      titleBarStyle: "hidden",
      webPreferences: {
        preload: settings.preloadPath,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        webSecurity: true,
        spellcheck: false,
        additionalArguments: []
      }
    }), JSON.stringify({ ...window.options, titleBarOverlay: undefined, trafficLightPosition: undefined, icon: undefined }));
    Assert.areEqual(settings.windowIndexPath, window.loadedFile);
    Assert.isFalse(window.isShown);
    verifyTitleBar(window);
  }

  @TestMethod
  public keepsItsProfileInTheCheckoutsDataDirectoryAndRunsTheRuntimeUnderElectronsNode(): void {
    const electron = new FakeElectron();
    const process = new FakeDesktopProcess("linux", ["electron", "main.js"], { KEPT: "yes" });
    const checkout = join(dirname(fileURLToPath(DesktopApplicationTests.MODULE_URL)), "..", "..", "..");
    const dataDirectory = DataDirectoryLocator.locate(false, {}, process.homeFolder, checkout);

    const [settings] = DesktopApplicationTests.start(electron, process);

    Assert.areEqual(`setPath userData ${join(dataDirectory.root, "desktop")}`, electron.app.calls[0]);
    Assert.areEqual(dataDirectory.root, settings?.dataDirectory.root);
    Assert.areEqual(JSON.stringify(["/electron/electron", RuntimeEntry.entryPath, "linux"]), JSON.stringify([settings?.executablePath, settings?.entryPath, settings?.platform]));
    Assert.areEqual(JSON.stringify({ KEPT: "yes", ELECTRON_RUN_AS_NODE: "1" }), JSON.stringify(settings?.environment));
  }

  @TestMethod
  public usesTheDataDirectoryAndProfileItIsGiven(): void {
    const electron = new FakeElectron();
    const data = join(dirname(fileURLToPath(DesktopApplicationTests.MODULE_URL)), "test-data");

    const [settings] = DesktopApplicationTests.start(electron, new FakeDesktopProcess("linux", [`--data-dir=${data}`, "--user-data-dir=/profile"]));

    Assert.areEqual(data, settings?.dataDirectory.root);
    Assert.isTrue(electron.app.calls.every(t => !t.startsWith("setPath")));
  }

  @TestMethod
  public keepsAPackagedBuildsDataInThePersonsDataDirectory(): void {
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("linux");

    const [settings] = DesktopApplicationTests.start(electron, process);

    Assert.areEqual(DataDirectoryLocator.locate(true, {}, process.homeFolder, "/unused").root, settings?.dataDirectory.root);
  }

  @TestMethod
  public treatsAStartThroughElectronsDefaultAppAsDevelopmentWhateverItsProgramIsCalled(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/teamrun/teamrun"));
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("win32");
    process.isDefaultApp = true;

    const [settings] = DesktopApplicationTests.start(electron, process, new FakeRuntimeLauncher(handover));
    return electron.app.becomeReadyAsync().then(async () => {
      await setImmediate();

      Assert.areEqual(DataDirectoryLocator.locate(false, {}, process.homeFolder, DesktopApplicationTests.checkoutRoot()).root, settings?.dataDirectory.root);
      Assert.areEqual(DesktopApplicationTests.DEVELOPMENT_APP_ID, DesktopApplicationTests.firstWindow(electron).appDetails?.appId);
      Assert.areEqual(0, process.started.length);
      Assert.areEqual(JSON.stringify({ kind: "NewerBuild", details: ["2.0.0"] }), JSON.stringify(electron.ipcMain.invoke("teamrun:readStartup", DesktopApplicationTests.trustedEvent("win32"))));
    });
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("linux", false)
  @TestData("win32", true)
  @TestData("darwin", false)
  public namesItsDesktopFileOnLinuxAfterItsAppId(platform: string, isPackaged: boolean): void {
    const electron = new FakeElectron(true, isPackaged);
    const appId = isPackaged ? "com.noldova.teamrun" : DesktopApplicationTests.DEVELOPMENT_APP_ID;

    DesktopApplicationTests.start(electron, new FakeDesktopProcess(platform));

    Assert.areEqual(platform === "linux" ? `setDesktopName ${appId}.desktop` : "", electron.app.calls.filter(t => t.startsWith("setDesktopName")).join(","));
  }

  @TestMethod
  public tellsItsWindowHowStartingTheRuntimeGoes(): Promise<void> {
    return DesktopApplicationTests.startReadyAsync("linux").then(electron => {
      const window = DesktopApplicationTests.firstWindow(electron);

      Assert.areEqual(JSON.stringify([
        ["teamrun:startupState", { kind: "Connecting", details: [] }],
        ["teamrun:startupState", { kind: "Ready", details: [] }]
      ]), JSON.stringify(window.webContents.sent));
      Assert.areEqual(JSON.stringify({ kind: "Ready", details: [] }), JSON.stringify(electron.ipcMain.invoke("teamrun:readStartup", DesktopApplicationTests.trustedEvent("linux"))));
      Assert.isNull(electron.ipcMain.invoke("teamrun:readStartup", { sender: { id: 1 }, senderFrame: null }));
    });
  }

  @TestMethod
  public carriesOutThePersonsStartupChoiceFromItsWindowOnly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")));
    return DesktopApplicationTests.startReadyAsync("linux", launcher).then(async electron => {
      const window = DesktopApplicationTests.firstWindow(electron);

      Assert.isFalse(electron.ipcMain.invoke("teamrun:startupAction", { sender: { id: 1 }, senderFrame: null }, "moveAside") as boolean);
      window.isGone = true;
      Assert.isTrue(await (electron.ipcMain.invoke("teamrun:startupAction", DesktopApplicationTests.trustedEvent("linux"), "moveAside") as Promise<boolean>));

      Assert.areEqual(JSON.stringify(["attach desktop IfIdle", "moveAside desktop IfIdle"]), JSON.stringify(launcher.calls));
      Assert.areEqual(2, window.webContents.sent.length);
    });
  }

  @TestMethod
  public handsAPackagedBuildOverToANewerBuildWithItsDataArgumentsAndQuits(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/teamrun/teamrun"));
    const process = new FakeDesktopProcess("linux", [
      "/opt/teamrun/teamrun-1", "--data-dir=/work/data", "--inspect=9229", "--user-data-dir=/work/profile", "--device-dir=/work/device", "--data-dir-extra"
    ]);
    const electron = new FakeElectron(true, true);
    DesktopApplicationTests.start(electron, process, new FakeRuntimeLauncher(handover));
    return electron.app.becomeReadyAsync().then(async () => {
      await setImmediate();

      Assert.areEqual(
        JSON.stringify([["/opt/teamrun/teamrun", "--data-dir=/work/data", "--user-data-dir=/work/profile", "--device-dir=/work/device"]]),
        JSON.stringify(process.started));
      Assert.areEqual("quit", electron.app.calls.at(-1));
    });
  }

  @TestMethod
  public saysANewerBuildRunsWhenADevelopmentBuildCannotHandOver(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/electron/electron"));
    return DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(handover)).then(electron => {
      Assert.areEqual(JSON.stringify({ kind: "NewerBuild", details: ["2.0.0"] }), JSON.stringify(electron.ipcMain.invoke("teamrun:readStartup", DesktopApplicationTests.trustedEvent("linux"))));
    });
  }

  @TestMethod
  public closesItsRuntimeConnectionWhenQuitting(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    return DesktopApplicationTests.startReadyAsync("linux", launcher).then(electron => {
      electron.app.emit("will-quit");

      Assert.isTrue(launcher.connections[0]?.isClosed === true);
    });
  }

  @TestMethod
  public async restoresTheSavedBoundsBeforeShowingTheWindow(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async readsTheDeviceIdentityFromTheFolderItIsGivenOrTheOperatingSystemsOne(): Promise<void> {
    const given = new FakeDeviceIdentity();
    const located = new FakeDeviceIdentity();
    const environment = { LOCALAPPDATA: "C:\\Users\\person\\AppData\\Local" };

    const first = new FakeElectron();
    const second = new FakeElectron();

    DesktopApplicationTests.start(first, new FakeDesktopProcess("win32", ["--device-dir=/devices/this"]), new FakeRuntimeLauncher(), given);
    DesktopApplicationTests.start(second, new FakeDesktopProcess("win32", [], environment, "C:\\Users\\person"), new FakeRuntimeLauncher(), located);
    await first.app.becomeReadyAsync();
    await second.app.becomeReadyAsync();

    Assert.areEqual(JSON.stringify(["/devices/this"]), JSON.stringify(given.folders));
    Assert.areEqual(JSON.stringify([DeviceIdentity.locateFolder("win32", environment, "C:\\Users\\person")]), JSON.stringify(located.folders));
  }

  @TestMethod
  public async keepsItsWindowsLayoutForThisDeviceThroughTheRuntime(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");

    const before = await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", event);
    const written = await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 });
    const after = await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", event);

    Assert.areEqual(JSON.stringify({ payload: null }), JSON.stringify(before));
    Assert.areEqual(JSON.stringify({ payload: null }), JSON.stringify(written));
    Assert.areEqual(JSON.stringify({ payload: { version: 1 } }), JSON.stringify(after));
    Assert.areEqual(JSON.stringify({ version: 1 }), JSON.stringify(connection.states.get(`writeWindowLayout:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async refusesALayoutFromAnUntrustedSenderOrOneThatIsNotAnObject(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const untrusted = { sender: { id: 1 }, senderFrame: null };
    const trusted = DesktopApplicationTests.trustedEvent("linux");

    const answers = [
      await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", untrusted),
      await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", untrusted, { version: 1 }),
      await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", trusted, [1])
    ];

    Assert.areEqual(
      JSON.stringify([
        { code: "Unauthorized", message: "Only TeamRun's own window may call the runtime." },
        { code: "Unauthorized", message: "Only TeamRun's own window may call the runtime." },
        { code: "InvalidMessage", message: "The layout must be a JSON object." }
      ]),
      JSON.stringify(answers.map(t => t["failure"])));
    Assert.isFalse(connection.calls.some(t => t.endsWith("Layout")));
  }

  @TestMethod
  public async answersThatItKeepsNoLayoutWhenTheDeviceHasNoIdentity(): Promise<void> {
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), device, process);
    const event = DesktopApplicationTests.trustedEvent("linux");

    const read = await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", event);
    const write = await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 });

    const failure = { code: "Unavailable", message: "This device has no identity, so the window's layout and Do not disturb are not kept." };
    Assert.areEqual(JSON.stringify([failure, failure]), JSON.stringify([read["failure"], write["failure"]]));
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "This device's identity").length);
  }

  @TestMethod
  public async answersALayoutTheRuntimeCannotKeepAsAFailureAndPassesOnDefects(): Promise<void> {
    const refused = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old"))));
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.length > 0);

    const unconnected = await DesktopApplicationTests.invokeAsync(refused, "teamrun:writeLayout", event, { version: 1 });
    connection.isFailing = true;
    const busy = await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", event);
    connection.rejection = new ConnectionException("The connection to the runtime closed.");
    const closed = await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 });
    connection.rejection = new TypeError("A defect.");

    await Assert.throwsAsync(() => DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 }), TypeError);
    Assert.areEqual(
      JSON.stringify([
        { code: "Unavailable", message: "TeamRun is not connected to its runtime." },
        { code: "Internal", message: "The database is busy." },
        { code: "Unavailable", message: "The connection to the runtime closed." }
      ]),
      JSON.stringify([unconnected["failure"], busy["failure"], closed["failure"]]));
  }

  @TestMethod
  public async passesItsWindowsRequestsToTheRuntimeAndAnswersAsItDoes(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("notes.open", Response.success("r", { title: "Notes" }));
    connection.answers.set("shell.modules", Response.success("r", { modules: [] }));
    connection.answers.set("shell.commands", Response.success("r", { commands: [] }));
    connection.answers.set("shell.runCommand", Response.success("r", 3));
    for (const name of DesktopApplicationTests.NOTIFICATION_METHODS)
      connection.answers.set(name, Response.success("r", name));
    connection.answers.set("notes.missing", Response.failure("r", new Failure(FailureCode.NotFound, "There is no such note.")));
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");

    const opened = await DesktopApplicationTests.requestAsync(electron, event, "notes.open", { path: "/notes/a.md" });
    const modules = await DesktopApplicationTests.requestAsync(electron, event, "shell.modules", null);
    const commands = await DesktopApplicationTests.requestAsync(electron, event, "shell.commands", null);
    const ran = await DesktopApplicationTests.requestAsync(electron, event, "shell.runCommand", { name: "clock.tick", arguments: null });
    const notifications = [];
    for (const name of DesktopApplicationTests.NOTIFICATION_METHODS)
      notifications.push((await DesktopApplicationTests.requestAsync(electron, event, name, null)).payload);
    const missing = await DesktopApplicationTests.requestAsync(electron, event, "notes.missing", null);

    Assert.areEqual(JSON.stringify({ title: "Notes" }), JSON.stringify(opened.payload));
    Assert.areEqual(JSON.stringify({ modules: [] }), JSON.stringify(modules.payload));
    Assert.areEqual(JSON.stringify({ commands: [] }), JSON.stringify(commands.payload));
    Assert.areEqual("3", JSON.stringify(ran.payload));
    Assert.areEqual(DesktopApplicationTests.NOTIFICATION_METHODS.join(","), notifications.join(","));
    Assert.areEqual(JSON.stringify({ code: "NotFound", message: "There is no such note." }), JSON.stringify(missing.failure?.toJson()));
  }

  @TestMethod
  public async addsThisDeviceToItsWindowsSettingsRequests(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    for (const name of ["shell.settings", "shell.setSetting", "shell.resetSetting"])
      connection.answers.set(name, Response.success("r", name));
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");

    const answers = [
      await DesktopApplicationTests.requestAsync(electron, event, "shell.settings", {}),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.setSetting", { name: "shell.panelSize", value: 15 }),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.resetSetting", { name: "shell.panelSize", device: "another" })
    ];
    const sent = connection.calls.flatMap((t, index) => t.includes("Setting") || t === "shell.settings" ? [connection.payloads[index]] : []);

    Assert.areEqual("shell.settings,shell.setSetting,shell.resetSetting", answers.map(t => t.payload).join(","));
    Assert.areEqual(JSON.stringify([
      { device: FakeDeviceIdentity.ID },
      { name: "shell.panelSize", value: 15, device: FakeDeviceIdentity.ID },
      { name: "shell.panelSize", device: FakeDeviceIdentity.ID }
    ]), JSON.stringify(sent));
  }

  @TestMethod
  public async refusesASettingsRequestWithoutAnObjectOrADevice(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const anonymous = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(new FakeRuntimeConnection()), new FakeElectron(), device);
    const event = DesktopApplicationTests.trustedEvent("linux");

    const failures = [
      await DesktopApplicationTests.requestAsync(electron, event, "shell.settings", null),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.setSetting", [1]),
      await DesktopApplicationTests.requestAsync(anonymous, event, "shell.settings", {})
    ].map(t => t.failure?.toJson());

    Assert.areEqual(JSON.stringify([
      { code: "InvalidMessage", message: "A settings request's payload must be a JSON object." },
      { code: "InvalidMessage", message: "A settings request's payload must be a JSON object." },
      { code: "Unavailable", message: "This device has no identity, so its settings cannot be read or changed." }
    ]), JSON.stringify(failures));
    Assert.isFalse(connection.calls.some(t => t.includes("etting")));
  }

  @TestMethod
  public async refusesRequestsItsWindowMayNotMake(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const trusted = DesktopApplicationTests.trustedEvent("linux");
    const requests: readonly [IIpcEvent, unknown, unknown][] = [
      [{ sender: { id: 1 }, senderFrame: null }, "notes.open", null],
      [trusted, 5, null],
      [trusted, "notes", null],
      [trusted, "notes.open", { at: (): number => 1 }],
      [trusted, "shell.stop", { policy: "IfIdle" }],
      [trusted, "shell.writeWindowLayout", null]
    ];

    const answers: string[] = [];
    for (const [event, method, payload] of requests)
      answers.push(String((await DesktopApplicationTests.requestAsync(electron, event, method, payload)).failure?.code));

    Assert.areEqual(JSON.stringify(["Unauthorized", "InvalidMessage", "InvalidMessage", "InvalidMessage", "Unauthorized", "Unauthorized"]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["shell.readWindowBounds"]), JSON.stringify(connection.calls));
  }

  @TestMethod
  public async answersUnavailableWithoutARuntimeAndPassesOnDefects(): Promise<void> {
    const refused = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old"))));
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.length > 0);

    const unconnected = await DesktopApplicationTests.requestAsync(refused, event, "notes.open", null);
    connection.rejection = new ConnectionException("The connection to the runtime closed.");
    const closed = await DesktopApplicationTests.requestAsync(electron, event, "notes.open", null);
    connection.rejection = new TypeError("A defect.");

    await Assert.throwsAsync(() => DesktopApplicationTests.requestAsync(electron, event, "notes.open", null), TypeError);
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "TeamRun is not connected to its runtime." }), JSON.stringify(unconnected.failure?.toJson()));
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "The connection to the runtime closed." }), JSON.stringify(closed.failure?.toJson()));
  }

  @TestMethod
  public async addsItsOwnDeviceToItsWindowsNotificationReadsAndRefusesTheirDoNotDisturbSwitch(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.notifications", Response.success("r", { notifications: [], isDoNotDisturb: true, mutedModules: ["notes"], sequence: 2 }));
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lost = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(new FakeRuntimeConnection()), new FakeElectron(), unidentified);

    const state = await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    const quiet = await DesktopApplicationTests.requestAsync(electron, event, "shell.setDoNotDisturb", { isOn: true });
    const noDevice = await DesktopApplicationTests.requestAsync(lost, event, "shell.notifications", {});

    const sent = connection.calls.map((t, index) => `${t} ${JSON.stringify(connection.payloads[index])}`).filter(t => t.startsWith("shell.notifications") || t.startsWith("shell.setDoNotDisturb"));
    Assert.areEqual(JSON.stringify([`shell.notifications {"device":"${FakeDeviceIdentity.ID}"}`]), JSON.stringify(sent));
    Assert.areEqual("{\"notifications\":[],\"isDoNotDisturb\":true,\"mutedModules\":[\"notes\"],\"sequence\":2}", JSON.stringify(state.payload));
    Assert.areEqual(FailureCode.Unauthorized, quiet.failure?.code);
    Assert.areEqual(FailureCode.Unavailable, noDevice.failure?.code);
  }

  @TestMethod
  public async givesItsWindowsTheNotificationStateForTheirOwnDeviceOnly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);
    await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", DesktopApplicationTests.trustedEvent("linux"));
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lostLauncher = new FakeRuntimeLauncher();
    const lost = await DesktopApplicationTests.startReadyAsync("linux", lostLauncher, new FakeElectron(), unidentified);
    await DesktopApplicationTests.invokeAsync(lost, "teamrun:readLayout", DesktopApplicationTests.trustedEvent("linux"));
    const broadcast = (devices: readonly string[]): Event => new Event(ShellEvents.notifications, new NotificationBroadcast([], devices, ["notes"], 4).toJson());

    launcher.listener?.onEvent(broadcast([FakeDeviceIdentity.ID, "desk"]));
    launcher.listener?.onEvent(broadcast(["desk"]));
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [] }));
    lostLauncher.listener?.onEvent(broadcast([FakeDeviceIdentity.ID]));

    Assert.areEqual(
      JSON.stringify([
        ["teamrun:runtimeEvent", "shell.notifications", { notifications: [], isDoNotDisturb: true, mutedModules: ["notes"], sequence: 4 }],
        ["teamrun:runtimeEvent", "shell.notifications", { notifications: [], isDoNotDisturb: false, mutedModules: ["notes"], sequence: 4 }]
      ]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:runtimeEvent")));
    Assert.areEqual(
      JSON.stringify([["teamrun:runtimeEvent", "shell.notifications", { notifications: [], isDoNotDisturb: false, mutedModules: ["notes"], sequence: 4 }]]),
      JSON.stringify(DesktopApplicationTests.firstWindow(lost).webContents.sent.filter(t => t[0] === "teamrun:runtimeEvent")));
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "The runtime's event shell.notifications could not be passed to the window").length);
  }

  @TestMethod
  public async showsTheOperatingSystemANotificationPostedAfterItsWindowsReadWhileNoWindowIsFocusedAndOpensItInTheWindow(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const early = DesktopApplicationTests.wireNotification(1, "Early");
    connection.answers.set("shell.notifications", Response.success("r", { notifications: [early], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher);
    const window = DesktopApplicationTests.firstWindow(electron);
    const later = DesktopApplicationTests.wireNotification(2, "Later");

    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [early], quietDevices: [], mutedModules: [], sequence: 1 }));
    await DesktopApplicationTests.requestAsync(electron, DesktopApplicationTests.trustedEvent("linux"), "shell.notifications", {});
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [later, early], quietDevices: [], mutedModules: [], sequence: 2 }));
    window.isFocusedNow = true;
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [DesktopApplicationTests.wireNotification(3, "Focused"), later, early], quietDevices: [], mutedModules: [], sequence: 3 }));
    window.isMinimizedNow = true;
    electron.notifications.created[0]?.click();

    Assert.areEqual("Later", electron.notifications.created.map(t => t.title).join(","));
    Assert.isTrue(String(electron.notifications.created[0]?.options.icon).endsWith("icon-dark-512.png"));
    Assert.areEqual("restore,focus", window.calls.filter(t => t === "restore" || t === "focus").join(","));
    Assert.areEqual(JSON.stringify([["teamrun:notificationOpened", 2]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:notificationOpened")));
  }

  @TestMethod
  public async holdsTheOperatingSystemsNotificationsWhileItsWindowReloadsUntilTheWindowReadsAgain(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const alarm = DesktopApplicationTests.wireNotification(1, "Alarm");
    connection.answers.set("shell.notifications", Response.success("r", { notifications: [alarm], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher);
    const window = DesktopApplicationTests.firstWindow(electron);
    const event = DesktopApplicationTests.trustedEvent("linux");
    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    const reposted = DesktopApplicationTests.wireNotification(2, "Re-posted by the window");

    window.webContents.startLoading();
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [reposted, alarm], quietDevices: [], mutedModules: [], sequence: 2 }));
    const whileLoading = electron.notifications.created.length;
    connection.answers.set("shell.notifications", Response.success("r", { notifications: [reposted, alarm], isDoNotDisturb: false, mutedModules: [], sequence: 2 }));
    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [DesktopApplicationTests.wireNotification(3, "Posted after"), reposted, alarm], quietDevices: [], mutedModules: [], sequence: 3 }));

    Assert.areEqual(0, whileLoading);
    Assert.areEqual("Posted after", electron.notifications.created.map(t => t.title).join(","));
  }

  @TestMethod
  public async showsTheOperatingSystemNothingWithoutAWindowReadForAKnownDeviceOrAfterTheRuntimeLeaves(): Promise<void> {
    const first = new FakeRuntimeConnection();
    first.answers.set("shell.notifications", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const second = new FakeRuntimeConnection();
    let reconnect: (connection: FakeRuntimeConnection) => void = () => undefined;
    const launcher = new FakeRuntimeLauncher(first, new Promise<FakeRuntimeConnection>(resolve => {
      reconnect = resolve;
    }));
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lostLauncher = new FakeRuntimeLauncher(new FakeRuntimeConnection());
    const lost = await DesktopApplicationTests.startReadyAsync("linux", lostLauncher, new FakeElectron(), unidentified);
    const event = DesktopApplicationTests.trustedEvent("linux");
    const posted = new Event(ShellEvents.notifications, { notifications: [DesktopApplicationTests.wireNotification(1, "Alarm")], quietDevices: [], mutedModules: [], sequence: 1 });

    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    await DesktopApplicationTests.requestAsync(lost, event, "shell.notifications", {});
    launcher.listener?.onEvent(posted);
    lostLauncher.listener?.onEvent(posted);
    first.answers.set("shell.notifications", Response.success("r", { notifications: [] }));
    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    first.answers.set("shell.notifications", Response.success("r", { notifications: [], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    launcher.listener?.onDisconnected();
    reconnect(second);
    await Condition.waitAsync(() => launcher.connections.length === 2);
    await setImmediate();
    launcher.listener?.onEvent(posted);

    Assert.areEqual("0,0", [electron.notifications.created.length, lost.notifications.created.length].join(","));
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "The notifications could not be read, so the operating system shows none until the window reads them again: ").length);
  }

  @TestMethod
  public async passesTheRuntimesEventsToItsWindowsThatRemain(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher);
    const window = DesktopApplicationTests.firstWindow(electron);

    launcher.listener?.onEvent(new Event(new QualifiedName("notes", "changed"), { path: "/notes/a.md" }));
    window.isGone = true;
    launcher.listener?.onEvent(new Event(new QualifiedName("notes", "changed"), null));

    Assert.areEqual(
      JSON.stringify([["teamrun:runtimeEvent", "notes.changed", { path: "/notes/a.md" }]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:runtimeEvent")));
  }

  @TestMethod
  public async passesASettingChangeOnlyToTheDeviceItConcernsWithoutItsDevice(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);
    const changed = new QualifiedName("shell", "settingsChanged");

    launcher.listener?.onEvent(new Event(changed, { name: "shell.mode", value: "Dark", isSet: true }));
    launcher.listener?.onEvent(new Event(changed, { name: "shell.panelSize", device: FakeDeviceIdentity.ID, value: 13, isSet: false }));
    launcher.listener?.onEvent(new Event(changed, { name: "shell.panelSize", device: "another", value: 16, isSet: true }));
    launcher.listener?.onEvent(new Event(changed, { value: 17 }));

    Assert.areEqual(
      JSON.stringify([
        ["teamrun:runtimeEvent", "shell.settingsChanged", { name: "shell.mode", value: "Dark", isSet: true }],
        ["teamrun:runtimeEvent", "shell.settingsChanged", { name: "shell.panelSize", value: 13, isSet: false }]
      ]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:runtimeEvent")));
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "The runtime's event shell.settingsChanged could not be passed to the window").length);
  }

  @TestMethod
  public async showsAWindowWhoseRuntimeIsSlowToStartAndRestoresItsBoundsOnceReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })));
    const window = DesktopApplicationTests.firstWindow(electron);
    const started = Date.now();

    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);
    await setImmediate();
    const isShownEarly = window.isShown;
    await Condition.waitAsync(() => window.isShown);
    const waited = Date.now() - started;
    arrive(connection);
    await Condition.waitAsync(() => window.calls.length > 1);

    Assert.isFalse(isShownEarly);
    Assert.isTrue(waited >= 1_900, `shown after ${waited} ms`);
    Assert.areEqual(JSON.stringify(["show", "setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async savesTheBoundsBeforeTheWindowCloses(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopApplicationTests.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    window.bounds = { x: 300, y: 150, width: 1100, height: 750 };

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(
      JSON.stringify({ x: 300, y: 150, width: 1100, height: 750, maximized: false }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async stopsClosingAWindowThatIsGoneWhileItsBoundsAreSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopApplicationTests.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    connection.onCall = () => window.destroy();

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await Condition.waitAsync(() => window.isGone);
    await setImmediate();

    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async closesEvenWhenTheBoundsCannotBeSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    connection.isFailing = true;

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "The window's bounds could not be saved: WindowStateException: The runtime refused shell.writeWindowBounds").length);
  }

  @TestMethod
  public async showsTheWindowWithItsDefaultBoundsWhenTheSavedOnesCannotBeUsed(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { width: 10 });
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "The window's saved bounds could not be restored, so it opens with its default bounds:").length);
  }

  @TestMethod
  public async showsTheWindowWithoutKeepingBoundsWhenTheDeviceHasNoIdentity(): Promise<void> {
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const connection = new FakeRuntimeConnection();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), device, process);
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(0, connection.calls.length);
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "This device's identity could not be read, so window bounds are not kept:").length);
  }

  @TestMethod
  public async showsARefusalAtOnceAndRestoresTheBoundsOnceTheRuntimeIsReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: true });
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")), connection);
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher);
    const window = DesktopApplicationTests.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    await (electron.ipcMain.invoke("teamrun:startupAction", DesktopApplicationTests.trustedEvent("linux"), "moveAside") as Promise<boolean>);
    await Condition.waitAsync(() => window.calls.includes("maximize"));

    Assert.areEqual(JSON.stringify(["show", "setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async writesBoundsMovedWhileTheRuntimeWasGoneOnceItIsReadyAgain(): Promise<void> {
    const first = new FakeRuntimeConnection();
    const second = new FakeRuntimeConnection();
    let reconnect: (connection: FakeRuntimeConnection) => void = () => undefined;
    const launcher = new FakeRuntimeLauncher(first, new Promise<FakeRuntimeConnection>(resolve => {
      reconnect = resolve;
    }));
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("shell.readWindowBounds"));

    launcher.listener?.onDisconnected();
    const readsBeforeTheMove = window.boundsReads;
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    const writesWhileGone = [...first.calls, ...second.calls].filter(t => t === "shell.writeWindowBounds").length;
    reconnect(second);
    await Condition.waitAsync(() => second.calls.includes("shell.writeWindowBounds"));

    Assert.areEqual(0, writesWhileGone);
    Assert.areEqual(JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }), JSON.stringify(second.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    Assert.areEqual(0, DesktopApplicationTests.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  public async reportsBoundsTheRuntimeRefusesOnceItIsReadyAgain(): Promise<void> {
    const first = new FakeRuntimeConnection();
    const second = new FakeRuntimeConnection();
    second.isFailing = true;
    let reconnect: (connection: FakeRuntimeConnection) => void = () => undefined;
    const launcher = new FakeRuntimeLauncher(first, new Promise<FakeRuntimeConnection>(resolve => {
      reconnect = resolve;
    }));
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("shell.readWindowBounds"));

    launcher.listener?.onDisconnected();
    const readsBeforeTheMove = window.boundsReads;
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    reconnect(second);
    await Condition.waitAsync(() => DesktopApplicationTests.readErrors(process, "The window's bounds").length > 0);

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: WindowStateException: The runtime refused shell.writeWindowBounds: The database is busy."]),
      JSON.stringify(DesktopApplicationTests.readErrors(process, "The window's bounds")));
  }

  @TestMethod
  public async tellsOnlyItsOwnWindowWhichBuildItIs(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");

    const build = electron.ipcMain.invoke("teamrun:readBuild", DesktopApplicationTests.trustedEvent("linux"));
    const refused = electron.ipcMain.invoke("teamrun:readBuild", { sender: { id: 1 }, senderFrame: null });

    Assert.areEqual(JSON.stringify(RuntimeBuild.identity.toJson()), JSON.stringify(build));
    Assert.isNull(refused);
  }

  @TestMethod
  public async copiesOnlyTextFromItsOwnWindowUpToTheLimit(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const trusted = DesktopApplicationTests.trustedEvent("linux");
    const longest = "x".repeat(65536);

    const answers = [
      electron.ipcMain.invoke("teamrun:copyText", trusted, "clock: Failed"),
      electron.ipcMain.invoke("teamrun:copyText", trusted, longest),
      electron.ipcMain.invoke("teamrun:copyText", trusted, `${longest}x`),
      electron.ipcMain.invoke("teamrun:copyText", trusted, 5),
      electron.ipcMain.invoke("teamrun:copyText", { sender: { id: 1 }, senderFrame: null }, "clock: Failed")
    ];

    Assert.areEqual(JSON.stringify([true, true, false, false, false]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["clock: Failed", longest]), JSON.stringify(electron.clipboard.texts));
  }

  @TestMethod
  public async editsItsOwnWindowWithTheSixEditActionsOnly(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const trusted = DesktopApplicationTests.trustedEvent("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    const answers = ["undo", "redo", "cut", "copy", "paste", "selectAll", "reload", 5].map(t => electron.ipcMain.invoke("teamrun:edit", trusted, t));
    const refused = electron.ipcMain.invoke("teamrun:edit", { sender: { id: 1 }, senderFrame: null }, "copy");

    Assert.areEqual(JSON.stringify([true, true, true, true, true, true, false, false]), JSON.stringify(answers));
    Assert.areEqual(false, refused);
    Assert.areEqual(JSON.stringify(["undo", "redo", "cut", "copy", "paste", "selectAll"]), JSON.stringify(window.webContents.calls));
  }

  @TestMethod
  public async opensTheLogFolderForItsOwnWindowAndCreatesItFirst(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      DesktopApplicationTests.start(electron, new FakeDesktopProcess("linux", [`--data-dir=${data}`]));
      await electron.app.becomeReadyAsync();

      const refused = await (electron.ipcMain.invoke("teamrun:openLogFolder", { sender: { id: 1 }, senderFrame: null }) as Promise<boolean>);
      const isOpened = await (electron.ipcMain.invoke("teamrun:openLogFolder", DesktopApplicationTests.trustedEvent("linux")) as Promise<boolean>);

      Assert.areEqual(false, refused);
      Assert.isTrue(isOpened);
      Assert.isTrue((await stat(join(data, "logs"))).isDirectory());
      Assert.areEqual(JSON.stringify([join(data, "logs")]), JSON.stringify(electron.shell.opened));
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async startsItsLogOnceARuntimeOwnsTheDataDirectoryAndNeverInDataFromBeforeTheShell(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const owned = join(data, "owned");
      const refused = join(data, "refused");
      await mkdir(owned);
      await mkdir(refused);
      const ownedProcess = new FakeDesktopProcess("linux", [`--data-dir=${owned}`]);
      const refusedProcess = new FakeDesktopProcess("linux", [`--data-dir=${refused}`]);
      const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), ownedProcess);
      const refusal = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData(refused)));
      const refusedElectron = await DesktopApplicationTests.startReadyAsync("linux", refusal, new FakeElectron(), new FakeDeviceIdentity(), refusedProcess);

      electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), { background: "red" });
      refusedElectron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), { background: "red" });
      await Condition.waitAsync(() => DesktopApplicationTests.firstWindow(refusedElectron).isShown);

      const lines = (await readFile(join(owned, "logs", "desktop.log"), "utf8")).trimEnd().split("\n");
      Assert.areEqual(1, lines.length);
      Assert.isTrue(/^\d{4}-\d\d-\d\dT[\d:.]+Z The window reported an appearance that is not valid/.test(lines[0] ?? ""));
      Assert.isFalse(existsSync(join(refused, "logs")));
      Assert.areEqual(1, DesktopApplicationTests.readErrors(refusedProcess, "The window reported").length);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async quitsOrOpensTheLogFolderAsThePersonChoosesForAWindowWhosePageStops(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const quitting = new FakeElectron();
      quitting.dialog.answers.push(1);
      const looping = new FakeElectron();
      looping.dialog.answers.push(0, 0);
      await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(), quitting);
      await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(), looping, new FakeDeviceIdentity(), new FakeDesktopProcess("linux", [`--data-dir=${data}`]));

      DesktopApplicationTests.firstWindow(quitting).webContents.goAway("crashed", 5);
      DesktopApplicationTests.firstWindow(looping).webContents.goAway("crashed", 5);
      await Condition.waitAsync(() => DesktopApplicationTests.firstWindow(looping).webContents.calls.includes("reload"));
      DesktopApplicationTests.firstWindow(looping).webContents.goAway("crashed", 5);
      await Condition.waitAsync(() => looping.shell.opened.length === 1);

      Assert.areEqual(1, quitting.app.calls.filter(t => t === "quit").length);
      Assert.areEqual(JSON.stringify([join(data, "logs")]), JSON.stringify(looping.shell.opened));
      Assert.areEqual(0, looping.app.calls.filter(t => t === "quit").length);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async reportsALogFolderItCannotCreateOrOpen(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const blocked = join(data, "blocked");
      await writeFile(blocked, "");
      const unopened = new FakeElectron();
      const uncreated = new FakeElectron();
      unopened.shell.failure = "There is no file manager.";
      const unopenedProcess = new FakeDesktopProcess("linux", [`--data-dir=${data}`]);
      const uncreatedProcess = new FakeDesktopProcess("linux", [`--data-dir=${blocked}`]);
      DesktopApplicationTests.start(unopened, unopenedProcess);
      DesktopApplicationTests.start(uncreated, uncreatedProcess);
      await unopened.app.becomeReadyAsync();
      await uncreated.app.becomeReadyAsync();
      const answers: boolean[] = [];

      answers.push(await (unopened.ipcMain.invoke("teamrun:openLogFolder", DesktopApplicationTests.trustedEvent("linux")) as Promise<boolean>));
      answers.push(await (uncreated.ipcMain.invoke("teamrun:openLogFolder", DesktopApplicationTests.trustedEvent("linux")) as Promise<boolean>));

      Assert.areEqual(JSON.stringify([false, false]), JSON.stringify(answers));
      Assert.areEqual(JSON.stringify(["The log folder could not be opened: There is no file manager."]), JSON.stringify(DesktopApplicationTests.readErrors(unopenedProcess, "The log folder")));
      Assert.isTrue(DesktopApplicationTests.readErrors(uncreatedProcess, "The log folder")[0]?.startsWith("The log folder could not be opened: Error:") === true);
      Assert.areEqual(0, uncreated.shell.opened.length);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  private static readErrors(process: FakeDesktopProcess, prefix: string): string[] {
    return process.errors.split("\n").map(t => t.slice(t.indexOf(" ") + 1)).filter(t => t.startsWith(prefix));
  }

  private static start(
    electron: FakeElectron,
    process: FakeDesktopProcess,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    appearance: FakeAppearanceStore = new FakeAppearanceStore()): LaunchSettings[] {
    const settings: LaunchSettings[] = [];
    DesktopApplication.start(electron, process, DesktopApplicationTests.MODULE_URL, t => {
      settings.push(t);
      return launcher;
    }, t => device.readAsync(t), t => appearance.create(t));
    return settings;
  }

  private static async startReadyAsync(
    platform: string,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    electron: FakeElectron = new FakeElectron(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    process: FakeDesktopProcess = new FakeDesktopProcess(platform),
    appearance: FakeAppearanceStore = new FakeAppearanceStore()): Promise<FakeElectron> {
    DesktopApplicationTests.start(electron, process, launcher, device, appearance);
    await electron.app.becomeReadyAsync();
    await setImmediate();
    return electron;
  }

  private static async invokeAsync(electron: FakeElectron, channel: string, event: IIpcEvent, ...values: unknown[]): Promise<Record<string, unknown>> {
    return await (electron.ipcMain.invoke(channel, event, ...values) as Promise<Record<string, unknown>>);
  }

  private static async requestAsync(electron: FakeElectron, event: IIpcEvent, method: unknown, payload: unknown): Promise<Response> {
    return Response.fromJson(await (electron.ipcMain.invoke("teamrun:request", event, method, payload) as Promise<unknown>));
  }

  private static closeRequests(window: FakeDesktopWindow): unknown[][] {
    return window.webContents.sent.filter(t => t[0] === "teamrun:closeRequest");
  }

  private static checkoutRoot(): string {
    return join(dirname(fileURLToPath(DesktopApplicationTests.MODULE_URL)), "..", "..", "..");
  }

  private static icon(name: string): string {
    return join(DesktopApplicationTests.checkoutRoot(), "assets", "icons", name);
  }

  private static click(item: MenuItemConstructorOptions | undefined): void {
    const click: ((...values: never[]) => void) | undefined = item?.click;
    click?.();
  }

  private static wireNotification(id: number, title: string): JsonObject {
    return { id, sequence: id, post: { kind: "clock.alarm", title, severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false };
  }

  private static firstWindow(electron: FakeElectron): FakeDesktopWindow {
    const [window] = electron.windows;
    Assert.isDefined(window);
    return window;
  }

  private static settings(platform: string): DesktopSettings {
    return DesktopSettings.fromModule(dirname(fileURLToPath(DesktopApplicationTests.MODULE_URL)), platform);
  }

  private static trustedEvent(platform: string): IIpcEvent {
    return { sender: { id: 1 }, senderFrame: { url: DesktopApplicationTests.settings(platform).windowUrl, parent: null } };
  }
}
