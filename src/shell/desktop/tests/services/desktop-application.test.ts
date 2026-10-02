/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname } from "node:path";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DesktopApplication, DesktopSettings, type IIpcEvent } from "@noldova/teamrun-shell-desktop";

import type { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";

@TestClass
export class DesktopApplicationTests {
  private static readonly MODULE_URL: string = pathToFileURL("/teamrun/node_modules/@noldova/teamrun-shell-desktop/main.js").href;
  private static readonly APPEARANCE: object = { background: "#181818", titleBar: "#181818", titleBarText: "#CCCCCC", titleBarHeight: 35 };

  @TestMethod
  public namesItselfAndKeepsOneInstanceInTheSandbox(): void {
    const electron = new FakeElectron();

    DesktopApplication.start(electron, DesktopApplicationTests.MODULE_URL, "win32");

    Assert.areEqual(
      JSON.stringify(["setName TeamRun", "setAppUserModelId com.noldova.teamrun", "requestSingleInstanceLock", "enableSandbox"]),
      JSON.stringify(electron.app.calls));
    Assert.areEqual(0, electron.windows.length);
  }

  @TestMethod
  public async quitsWhenAnotherInstanceRuns(): Promise<void> {
    const electron = new FakeElectron(false);

    DesktopApplication.start(electron, DesktopApplicationTests.MODULE_URL, "win32");
    await electron.app.becomeReadyAsync();

    Assert.areEqual(JSON.stringify(["setName TeamRun", "setAppUserModelId com.noldova.teamrun", "requestSingleInstanceLock", "quit"]), JSON.stringify(electron.app.calls));
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
  public opensAHiddenSecureWindowWithTrafficLightsOnMacOS(): Promise<void> {
    return DesktopApplicationTests.verifyWindowAsync("darwin", window => {
      Assert.isUndefined(window.options.titleBarOverlay);
      Assert.areEqual(JSON.stringify({ x: 12, y: 10 }), JSON.stringify(window.options.trafficLightPosition));
    });
  }

  @TestMethod
  @TestData("win32", "null")
  @TestData("darwin", "[\"appMenu\",\"editMenu\",\"windowMenu\"]")
  public async setsTheStandardMenuOnlyOnMacOS(platform: string, menu: string): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync(platform);

    Assert.areEqual(menu, JSON.stringify(electron.menu.menu));
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

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.areEqual(overlay, JSON.stringify(window.overlay));
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async showsTheWindowWithoutAnAppearanceItCannotUse(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);
    const written: string[] = [];
    const write = process.stderr.write;
    process.stderr.write = ((text: string): boolean => written.push(text) > 0) as typeof process.stderr.write;
    try {
      electron.ipcMain.send("teamrun:ready", DesktopApplicationTests.trustedEvent("linux"), { background: "red" });
    }
    finally {
      process.stderr.write = write;
    }

    Assert.isNull(window.backgroundColor);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify(["The window reported an appearance that is not valid, so it is shown without it: JsonException: $.titleBar: The field is required.\n"]),
      JSON.stringify(written));
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
      Assert.isFalse(electron.ipcMain.invoke("teamrun:closeAnswer", event, "request", true) === true);
    }

    Assert.areEqual("[]", JSON.stringify(window.calls));
  }

  @TestMethod
  public async closesOnlyAfterThePageSaysItSaved(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    window.close();
    window.close();
    const [request] = window.webContents.sent;

    Assert.areEqual(1, window.webContents.sent.length);
    Assert.areEqual("teamrun:closeRequest", request?.[0]);
    Assert.isFalse(window.isGone);
    Assert.isTrue(electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), request?.[1], true) === true);
    await setImmediate();
    Assert.isTrue(window.isGone);
  }

  @TestMethod
  public async staysOpenWhenThePageKeepsUnsavedWork(): Promise<void> {
    const electron = await DesktopApplicationTests.startReadyAsync("linux");
    const window = DesktopApplicationTests.firstWindow(electron);

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), window.webContents.sent[0]?.[1], false);
    await setImmediate();
    window.close();

    Assert.isFalse(window.isGone);
    Assert.areEqual(2, window.webContents.sent.length);
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

    Assert.areEqual(0, window.webContents.sent.length);
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
        spellcheck: false
      }
    }), JSON.stringify({ ...window.options, titleBarOverlay: undefined, trafficLightPosition: undefined }));
    Assert.areEqual(settings.windowIndexPath, window.loadedFile);
    Assert.isFalse(window.isShown);
    verifyTitleBar(window);
  }

  private static async startReadyAsync(platform: string): Promise<FakeElectron> {
    const electron = new FakeElectron();
    DesktopApplication.start(electron, DesktopApplicationTests.MODULE_URL, platform);
    await electron.app.becomeReadyAsync();
    return electron;
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
