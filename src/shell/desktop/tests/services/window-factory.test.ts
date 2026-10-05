/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { Condition } from "../fixtures/condition.fixture.js";
import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import type { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";

@TestClass
export class WindowFactoryTests {
  @TestMethod
  public async describesItsWindowsToTheWindowsTaskbarAsThisBuild(): Promise<void> {
    const data = resolve("data");
    const packaged = new FakeElectron(true, true);
    DesktopStartFixture.start(packaged, new FakeDesktopProcess("win32", [`--data-dir=${data}`]));
    const development = new FakeElectron();
    DesktopStartFixture.start(development, new FakeDesktopProcess("win32"));
    const linux = new FakeElectron();
    DesktopStartFixture.start(linux, new FakeDesktopProcess("linux"));
    await Promise.all([packaged.app.becomeReadyAsync(), development.app.becomeReadyAsync(), linux.app.becomeReadyAsync()]);
    const mainScript = resolve(fileURLToPath(DesktopStartFixture.MODULE_URL));

    Assert.areEqual(`"/electron/electron" "--data-dir=${data}"`, DesktopStartFixture.firstWindow(packaged).appDetails?.relaunchCommand);
    Assert.areEqual("com.noldova.teamrun", DesktopStartFixture.firstWindow(packaged).appDetails?.appId);
    Assert.areEqual(`"/electron/electron" "${mainScript}"`, DesktopStartFixture.firstWindow(development).appDetails?.relaunchCommand);
    Assert.areEqual(DesktopStartFixture.DEVELOPMENT_APP_ID, DesktopStartFixture.firstWindow(development).appDetails?.appId);
    Assert.isNull(DesktopStartFixture.firstWindow(linux).appDetails);
  }

  @TestMethod
  public opensAHiddenSecureWindowWithTheTitleBarOverlayOnWindowsAndLinux(): Promise<void> {
    return WindowFactoryTests.verifyWindowAsync("linux", window => {
      Assert.isTrue(window.options.titleBarOverlay === true);
      Assert.isUndefined(window.options.trafficLightPosition);
    });
  }

  @TestMethod
  public opensAHiddenSecureWindowWithTrafficLightsOnMacOS(): Promise<void> {
    return WindowFactoryTests.verifyWindowAsync("darwin", window => {
      Assert.isUndefined(window.options.titleBarOverlay);
      Assert.areEqual(JSON.stringify({ x: 12, y: 9 }), JSON.stringify(window.options.trafficLightPosition));
    });
  }

  @TestMethod
  public async keepsTheWindowOnItsOwnPage(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const contents = DesktopStartFixture.firstWindow(electron).webContents;
    const windowUrl = DesktopStartFixture.settings("linux").windowUrl;

    Assert.isTrue(contents.navigate("will-navigate", "https://example.com/"));
    Assert.isFalse(contents.navigate("will-navigate", `${windowUrl}#settings`));
    Assert.isTrue(contents.navigate("will-redirect", "https://example.com/"));
    Assert.isFalse(contents.navigate("will-redirect", windowUrl));
    Assert.isTrue(contents.navigate("will-attach-webview"));
    Assert.areEqual(JSON.stringify({ action: "deny" }), JSON.stringify(contents.openWindow()));
  }

  @TestMethod
  @TestData("linux", "{\"color\":\"#FFFFFF\",\"symbolColor\":\"#111111\",\"height\":35}")
  @TestData("win32", "{\"color\":\"#FFFFFF\",\"symbolColor\":\"#111111\",\"height\":35}")
  @TestData("darwin", "null")
  public async paintsTheWindowAgainWhenItsPageReportsAChangedAppearanceWithoutShowingItAgain(platform: string, overlay: string): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync(platform);
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent(platform), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    electron.ipcMain.send("teamrun:appearance", DesktopStartFixture.trustedEvent(platform),
      { background: "#FFFFFF", titleBar: "#FFFFFF", titleBarText: "#111111", titleBarHeight: 35 });

    Assert.areEqual("#FFFFFF", window.backgroundColor);
    Assert.areEqual(overlay, JSON.stringify(window.overlay));
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
  }

  private static async verifyWindowAsync(platform: string, verifyTitleBar: (window: FakeDesktopWindow) => void): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync(platform);
    const window = DesktopStartFixture.firstWindow(electron);
    const settings = DesktopStartFixture.settings(platform);

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
}
