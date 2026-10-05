/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeDockHost } from "../fixtures/fake-dock-host.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";

@TestClass
export class AppIconsTests {
  @TestMethod
  @TestData("win32", "icon-dark.ico")
  @TestData("linux", "icon-dark-512.png")
  public async givesItsWindowTheOneOutlinedIconWhateverTheSystemsAppearance(platform: string, icon: string): Promise<void> {
    const window = DesktopStartFixture.firstWindow(await DesktopStartFixture.startReadyAsync(platform));

    Assert.areEqual(DesktopStartFixture.icon(icon), window.options.icon);
    Assert.areEqual(platform === "win32" ? DesktopStartFixture.icon(icon) : undefined, window.appDetails?.appIconPath);
  }

  @TestMethod
  public async pointsAPackagedBuildsTaskbarAtItsProgramWhoseIconTheShellCanRead(): Promise<void> {
    const process = new FakeDesktopProcess("win32");
    const window = DesktopStartFixture.firstWindow(await DesktopStartFixture.startReadyAsync("win32", undefined, new FakeElectron(true, true), undefined, process));

    Assert.areEqual(DesktopStartFixture.icon("icon-dark.ico"), window.options.icon);
    Assert.areEqual(process.execPath, window.appDetails?.appIconPath);
  }

  @TestMethod
  public async showsItsIconInTheDockOnMacOSAndLeavesTheWindowsIconToTheBundle(): Promise<void> {
    const electron = new FakeElectron();
    const dock = new FakeDockHost();
    electron.app.dock = dock;

    await DesktopStartFixture.startReadyAsync("darwin", undefined, electron);

    Assert.areEqual(JSON.stringify([DesktopStartFixture.icon("icon-dock-512.png")]), JSON.stringify(dock.icons));
    Assert.isUndefined(DesktopStartFixture.firstWindow(electron).options.icon);
  }
}
