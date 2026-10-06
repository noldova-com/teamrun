/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Failure, FailureCode, Response } from "@noldova/teamrun-shell-protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class DeviceSettingFollowerTests {
  @TestMethod
  public async followsTheSettingForThisDeviceAndHidesTheIconWhileItIsOff(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("shell.readSetting", Response.success("r", { name: "shell.trayIcon", value: false, isSet: true }));
    await fixture.startAsync();
    const hidden = fixture.electron.tray.shown;
    const change = (device: string | null, value: boolean, scope: JsonObject | null = null): JsonObject =>
      ({ name: "shell.trayIcon", ...scope === null ? {} : { scope }, ...device === null ? {} : { device }, value, isSet: true });

    fixture.send("settingsChanged", change("desk", true));
    fixture.send("settingsChanged", change(FakeDeviceIdentity.ID, true, { name: "notes.project", id: "p1" }));
    fixture.send("settingsChanged", { name: "shell.doNotDisturb", device: FakeDeviceIdentity.ID, value: true, isSet: true });
    const ignored = fixture.electron.tray.shown;
    fixture.send("settingsChanged", change(FakeDeviceIdentity.ID, true));
    fixture.send("settingsChanged", change(FakeDeviceIdentity.ID, true));

    Assert.isTrue(fixture.electron.tray.trays[0]?.isDestroyed === true);
    Assert.isUndefined(hidden);
    Assert.isUndefined(ignored);
    Assert.areEqual(2, fixture.electron.tray.trays.length);
    Assert.areEqual(DesktopStartFixture.icon("tray/tray-idle.ico"), fixture.tray.images.at(-1));
  }

  @TestMethod
  public async keepsTheNewerChangeWhenItArrivesWhileTheSettingIsRead(): Promise<void> {
    const fixture = new TrayFixture("win32");
    const read = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("shell.readSetting", () => read.promise);
    await DesktopStartFixture.startReadyAsync("win32", fixture.launcher, fixture.electron, new FakeDeviceIdentity(), fixture.process);
    await Condition.waitAsync(() => fixture.connection.calls.includes("shell.readSetting"));

    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    read.resolve(Response.success("r", { name: "shell.trayIcon", value: true, isSet: true }));
    await setImmediate();

    Assert.isUndefined(fixture.electron.tray.shown);
  }

  @TestMethod
  public async keepsItsSettingAndLogsWhenTheRuntimeCannotReadItOrItsState(): Promise<void> {
    const failing = new TrayFixture("win32");
    failing.connection.answers.set("shell.readSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    failing.connection.answers.set("shell.work", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    failing.connection.answers.set("shell.notifications", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const malformed = new TrayFixture("win32");
    malformed.connection.answers.set("shell.readSetting", Response.success("r", { value: false }));
    malformed.connection.answers.set("shell.notifications", Response.success("r", { notifications: [] }));

    await failing.startAsync();
    await malformed.startAsync();

    Assert.isDefined(failing.electron.tray.shown);
    Assert.isDefined(malformed.electron.tray.shown);
    Assert.areEqual(1, DesktopStartFixture.readErrors(failing.process, "The setting shell.trayIcon could not be read for this device, so the desktop keeps its last value: The database is busy.").length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(malformed.process, "The setting shell.trayIcon could not be read for this device, so the desktop keeps its last value: ").length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(malformed.process, "The tray icon could not read the runtime's work and notifications: ").length);
  }
}
