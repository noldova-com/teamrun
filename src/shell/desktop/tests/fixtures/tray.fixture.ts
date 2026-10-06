/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import type { MenuItemConstructorOptions } from "electron";

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert } from "@noldova/teamrun-foundation-testing";
import { Event, ShellEvents } from "@noldova/teamrun-shell-protocol";

import { Condition } from "./condition.fixture.js";
import { DesktopStartFixture } from "./desktop-start.fixture.js";
import { FakeDesktopProcess } from "./fake-desktop-process.fixture.js";
import { FakeDeviceFiles } from "./fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "./fake-device-identity.fixture.js";
import { FakeElectron } from "./fake-electron.fixture.js";
import { FakeRuntimeConnection } from "./fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "./fake-runtime-launcher.fixture.js";
import type { FakeTray } from "./fake-tray.fixture.js";

export class TrayFixture {
  public readonly connection: FakeRuntimeConnection = new FakeRuntimeConnection();
  public readonly launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(this.connection);
  public readonly electron: FakeElectron = new FakeElectron();
  public readonly files: FakeDeviceFiles = new FakeDeviceFiles();
  public readonly process: FakeDesktopProcess;

  public constructor(platform: string) {
    this.process = new FakeDesktopProcess(platform);
  }

  public get tray(): FakeTray {
    const tray = this.electron.tray.shown;
    Assert.isDefined(tray, "No tray icon shows.");
    return tray;
  }

  public get menu(): MenuItemConstructorOptions[] {
    const menu = this.tray.menus.at(-1);
    const template = this.electron.menu.templates.find(t => t === menu);
    Assert.isDefined(template, "The tray icon has no menu.");
    return template;
  }

  public get rows(): string[] {
    return this.menu.map(t => t.type === "separator" ? "-" : `${t.label ?? ""}${t.enabled === false ? " (disabled)" : ""}${t.type === "checkbox" ? ` [${t.checked === true ? "x" : " "}]` : ""}`);
  }

  public static notification(id: number, title: string, owner: string = "clock", isRead: boolean = false): JsonObject {
    return { id: String(id), sequence: id, post: { kind: `${owner}.alarm`, title, severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead };
  }

  public async startAsync(): Promise<void> {
    await DesktopStartFixture.startReadyAsync(this.process.platform, this.launcher, this.electron, new FakeDeviceIdentity(), this.process, this.files);
    await Condition.waitAsync(() => this.connection.calls.includes("shell.readSetting"));
    await setImmediate();
  }

  public send(name: string, payload: JsonObject): void {
    this.launcher.listener?.onEvent(new Event(name === "work" ? ShellEvents.work : name === "notifications" ? ShellEvents.notifications : ShellEvents.settingsChanged, payload));
  }

  public click(label: string): void {
    DesktopStartFixture.click(this.menu.find(t => t.label === label));
  }
}
