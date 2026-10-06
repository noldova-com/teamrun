/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { MenuItemConstructorOptions } from "electron";

import { Assert } from "@noldova/teamrun-foundation-testing";
import type { Installation, LaunchSettings } from "@noldova/teamrun-shell-runtime";
import { DesktopApplication, DesktopSettings, type IIpcEvent } from "@noldova/teamrun-shell-desktop";

import { Condition } from "./condition.fixture.js";
import { FakeAppearanceStore } from "./fake-appearance-store.fixture.js";
import { FakeDesktopProcess } from "./fake-desktop-process.fixture.js";
import type { FakeDesktopWindow } from "./fake-desktop-window.fixture.js";
import { FakeDeviceIdentity } from "./fake-device-identity.fixture.js";
import { FakeElectron } from "./fake-electron.fixture.js";
import { FakePathCommand } from "./fake-path-command.fixture.js";
import { FakeRuntimeLauncher } from "./fake-runtime-launcher.fixture.js";

export class DesktopStartFixture {
  public static readonly MODULE_URL: string = pathToFileURL("/teamrun/node_modules/@noldova/teamrun-shell-desktop/main.js").href;
  public static readonly DEVELOPMENT_APP_ID: string = `com.noldova.teamrun.development.${createHash("sha256")
    .update(resolve(dirname(fileURLToPath(DesktopStartFixture.MODULE_URL)), "..", "..", ".."))
    .digest("hex")
    .slice(0, 8)}`;

  public static readonly APPEARANCE: object = { background: "#181818", titleBar: "#181818", titleBarText: "#CCCCCC", titleBarHeight: 35 };

  public static start(
    electron: FakeElectron,
    process: FakeDesktopProcess,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    appearance: FakeAppearanceStore = new FakeAppearanceStore(),
    pathCommand: FakePathCommand = new FakePathCommand(),
    installations: Installation[] = [],
    recordDesktopAsync: (installation: Installation) => Promise<boolean> = () => Promise.resolve(true)): LaunchSettings[] {
    const settings: LaunchSettings[] = [];
    DesktopApplication.start(electron, process, DesktopStartFixture.MODULE_URL, (t, installation) => {
      settings.push(t);
      installations.push(installation);
      return launcher;
    }, t => device.readAsync(t), t => appearance.create(t), t => pathCommand.create(t), recordDesktopAsync);
    return settings;
  }

  public static async startReadyAsync(
    platform: string,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    electron: FakeElectron = new FakeElectron(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    process: FakeDesktopProcess = new FakeDesktopProcess(platform),
    appearance: FakeAppearanceStore = new FakeAppearanceStore()): Promise<FakeElectron> {
    DesktopStartFixture.start(electron, process, launcher, device, appearance);
    await DesktopStartFixture.openAsync(electron);
    await setImmediate();
    return electron;
  }

  public static async openAsync(electron: FakeElectron): Promise<void> {
    await electron.app.becomeReadyAsync();
    await Condition.waitAsync(() => electron.windows.length > 0);
  }

  public static async verifyMenuBarRefusedAsync(menuBar: string, reason: string): Promise<void> {
    const process = new FakeDesktopProcess("darwin");
    const electron = await DesktopStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const built = electron.menu.templates.length;

    electron.ipcMain.send("teamrun:menuBar", DesktopStartFixture.trustedEvent("darwin"), JSON.parse(menuBar));
    const errors = DesktopStartFixture.readErrors(process, "The window sent a menu bar that is not valid, so the menu bar is unchanged: ");

    Assert.areEqual(built, electron.menu.templates.length);
    Assert.areEqual(1, errors.length);
    Assert.isTrue(errors[0]?.includes(reason) === true, errors.join("\n"));
  }

  public static readErrors(process: FakeDesktopProcess, prefix: string): string[] {
    return process.errors.split("\n").map(t => t.slice(t.indexOf(" ") + 1)).filter(t => t.startsWith(prefix));
  }

  public static checkoutRoot(): string {
    return join(dirname(fileURLToPath(DesktopStartFixture.MODULE_URL)), "..", "..", "..");
  }

  public static icon(name: string): string {
    return join(DesktopStartFixture.checkoutRoot(), "assets", "icons", name);
  }

  public static click(item: MenuItemConstructorOptions | undefined): void {
    const click: ((...values: never[]) => void) | undefined = item?.click;
    click?.();
  }

  public static firstWindow(electron: FakeElectron): FakeDesktopWindow {
    const [window] = electron.windows;
    Assert.isDefined(window);
    return window;
  }

  public static settings(platform: string): DesktopSettings {
    return DesktopSettings.fromModule(dirname(fileURLToPath(DesktopStartFixture.MODULE_URL)), platform);
  }

  public static trustedEvent(platform: string): IIpcEvent {
    return { sender: { id: 1 }, senderFrame: { url: DesktopStartFixture.settings(platform).windowUrl, parent: null } };
  }
}
