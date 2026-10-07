/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Failure, FailureCode, Response, SettingValue } from "@noldova/teamrun-shell-protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class TrayControllerTests {
  @TestMethod
  public async showsTheIdleIconWithItsToolTipAndMenuOnWindowsAndReadsWorkNotificationsAndTheSettingOnceTheRuntimeIsReady(): Promise<void> {
    const fixture = new TrayFixture("win32");

    await fixture.startAsync();

    Assert.areEqual(1, fixture.electron.tray.trays.length);
    Assert.areEqual(DesktopStartFixture.icon("tray/tray-idle.ico"), fixture.tray.images.at(-1));
    Assert.areEqual("TeamRun", fixture.tray.toolTips.at(-1));
    Assert.areEqual(JSON.stringify(["No work running (disabled)", "-", "Open TeamRun", "Do not disturb [ ]", "-", "Quit TeamRun"]), JSON.stringify(fixture.rows));
    const reads = fixture.connection.calls.map((t, index) => `${t} ${JSON.stringify(fixture.connection.payloads[index])}`)
      .filter(t => t.startsWith("shell.readSetting") || t.startsWith("shell.notifications"));
    Assert.areEqual(
      JSON.stringify([`shell.notifications {"device":"${FakeDeviceIdentity.ID}"}`, `shell.readSetting {"name":"shell.trayIcon","device":"${FakeDeviceIdentity.ID}"}`]),
      JSON.stringify(reads.sort()));
  }

  @TestMethod
  public async showsRunningWorkAndUnreadNotificationsAsTheBellCountsThemInItsImageToolTipAndMenu(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const work = ["Reply to Ada", "Run the tests", "Build", "Lint", "Format", "Deploy", "Index"];

    fixture.send("work", { descriptions: work, sequence: 2 });
    fixture.send("work", { descriptions: [], sequence: 1 });
    const running = [fixture.tray.images.at(-1), fixture.tray.toolTips.at(-1)];
    fixture.send("notifications", {
      notifications: [
        TrayFixture.notification(5, "Muted", "notes"), TrayFixture.notification(4, "Fourth"), TrayFixture.notification(3, "Third"), TrayFixture.notification(2, "Read", "clock", true),
        TrayFixture.notification(1, "First")
      ],
      quietDevices: [], mutedModules: ["notes"], sequence: 5
    });

    Assert.areEqual(JSON.stringify([DesktopStartFixture.icon("tray/tray-running.ico"), "TeamRun: 7 running"]), JSON.stringify(running));
    Assert.areEqual(DesktopStartFixture.icon("tray/tray-both.ico"), fixture.tray.images.at(-1));
    Assert.areEqual("TeamRun: 7 running, 3 unread", fixture.tray.toolTips.at(-1));
    Assert.areEqual(
      JSON.stringify([
        "Reply to Ada (disabled)", "Run the tests (disabled)", "Build (disabled)", "Lint (disabled)", "Format (disabled)", "and 2 more (disabled)",
        "Fourth", "Third", "First", "-", "Open TeamRun", "Do not disturb [ ]", "-", "Quit TeamRun"
      ]),
      JSON.stringify(fixture.rows));
  }

  @TestMethod
  public async showsTheUnreadImageWithoutWorkAndChangesOnlyWhatChanged(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const menus = fixture.tray.menus.length;
    const broadcast = { notifications: [TrayFixture.notification(1, "Alarm")], quietDevices: [], mutedModules: [], sequence: 1 };

    fixture.send("notifications", broadcast);
    fixture.send("notifications", broadcast);
    fixture.send("notifications", { notifications: [], quietDevices: [], mutedModules: [], sequence: 0 });

    Assert.areEqual(DesktopStartFixture.icon("tray/tray-unread.ico"), fixture.tray.images.at(-1));
    Assert.areEqual("TeamRun: 1 unread", fixture.tray.toolTips.at(-1));
    Assert.areEqual(2, fixture.tray.images.length);
    Assert.areEqual(2, fixture.tray.toolTips.length);
    Assert.areEqual(menus + 1, fixture.tray.menus.length);
  }

  @TestMethod
  public async opensANotificationFromItsMenuAndChecksDoNotDisturbForThisDeviceOnly(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);

    fixture.send("notifications", { notifications: [TrayFixture.notification(1, "Alarm & clock")], quietDevices: [FakeDeviceIdentity.ID], mutedModules: [], sequence: 1 });
    fixture.click("Alarm && clock");
    fixture.click("Do not disturb");
    await Condition.waitAsync(() => fixture.connection.calls.includes("shell.setSetting"));
    fixture.send("notifications", { notifications: [], quietDevices: ["desk"], mutedModules: [], sequence: 1 });

    Assert.isTrue(fixture.rows.includes("Do not disturb [ ]"));
    Assert.areEqual(JSON.stringify([["teamrun:notificationOpened", "1"]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:notificationOpened")));
    const set = SettingValue.fromJson(fixture.connection.payloads[fixture.connection.calls.indexOf("shell.setSetting")]);
    Assert.areEqual(`shell.doNotDisturb ${FakeDeviceIdentity.ID} false`, `${set.key.name.text} ${set.key.device ?? ""} ${String(set.value)}`);
  }

  @TestMethod
  public async logsWhenDoNotDisturbCannotBeSetAndSetsNothingWithoutADevice(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("shell.setSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    await fixture.startAsync();
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lost = new FakeElectron();
    const lostConnection = new FakeRuntimeConnection();
    await DesktopStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(lostConnection), lost, unidentified);
    const menus = fixture.tray.menus.length;
    const lostMenus = lost.tray.shown?.menus.length ?? 0;

    fixture.click("Do not disturb");
    DesktopStartFixture.click(lost.menu.templates.find(t => t === lost.tray.shown?.menus.at(-1))?.find(t => t.label === "Do not disturb"));
    await Condition.waitAsync(() => fixture.tray.menus.length > menus && (lost.tray.shown?.menus.length ?? 0) > lostMenus);
    await setImmediate();

    Assert.areEqual(1, DesktopStartFixture.readErrors(fixture.process, "Do not disturb could not be changed from the tray: The database is busy.").length);
    Assert.areEqual(menus + 1, fixture.tray.menus.length);
    Assert.areEqual(lostMenus + 1, lost.tray.shown?.menus.length);
    Assert.isTrue(fixture.rows.includes("Do not disturb [ ]"));
    Assert.isFalse(lostConnection.calls.includes("shell.setSetting"));
    Assert.isFalse(lostConnection.calls.includes("shell.notifications"));
  }

  @TestMethod
  public async opensTheWindowFromItsMenuOrAClickOnWindowsAndLinuxAndLeavesAMacClickToTheMenu(): Promise<void> {
    const windows = new TrayFixture("win32");
    await windows.startAsync();
    const window = DesktopStartFixture.firstWindow(windows.electron);
    const linux = new TrayFixture("linux");
    await linux.startAsync();
    await linux.process.programs.answerAsync("(<true>,)\n");
    const mac = new TrayFixture("darwin");
    await mac.startAsync();
    await DesktopStartFixture.showAsync(windows.electron, "win32", window);
    await DesktopStartFixture.showAsync(linux.electron, "linux", DesktopStartFixture.firstWindow(linux.electron));
    window.isMinimizedNow = true;

    windows.tray.click();
    window.isMinimizedNow = false;
    windows.click("Open TeamRun");
    linux.tray.click();
    window.destroy();
    windows.click("Open TeamRun");
    windows.click("Quit TeamRun");
    const reopened = windows.electron.windows[1];
    Assert.isDefined(reopened);
    await DesktopStartFixture.answerSaveAsync(windows.electron, "win32", reopened, 1);
    await Condition.waitAsync(() => windows.electron.app.calls.includes("quit"));

    Assert.areEqual("restore,focus,focus", window.calls.filter(t => t === "restore" || t === "focus").join(","));
    Assert.areEqual(2, windows.electron.windows.length);
    Assert.isTrue(DesktopStartFixture.firstWindow(linux.electron).calls.includes("focus"));
    Assert.areEqual(DesktopStartFixture.icon("tray/tray-idle.png"), linux.tray.images.at(-1));
    Assert.areEqual(DesktopStartFixture.icon("tray/tray-idleTemplate.png"), mac.tray.images.at(-1));
    Assert.areEqual("1,1,0", [windows.tray.listeners, linux.tray.listeners, mac.tray.listeners].join(","));
    Assert.isTrue(windows.electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async showsOnMacOSOnlyOnceTheSettingIsOn(): Promise<void> {
    const fixture = new TrayFixture("darwin");
    fixture.connection.answers.set("shell.readSetting", Response.success("r", { name: "shell.trayIcon", value: false, isSet: false }));

    await fixture.startAsync();
    const before = fixture.electron.tray.trays.length;
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: true });

    Assert.areEqual(0, before);
    Assert.areEqual(DesktopStartFixture.icon("tray/tray-idleTemplate.png"), fixture.tray.images.at(-1));
  }

  @TestMethod
  public async showsOnLinuxOnlyWhileTheSessionBusHasATrayHost(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    const before = fixture.electron.tray.trays.length;

    await fixture.process.programs.answerAsync("(<true>,)\n");
    const shown = fixture.electron.tray.shown;
    fixture.process.programs.output("StatusNotifierHostUnregistered");
    await fixture.process.programs.answerAsync("(<false>,)\n");

    Assert.areEqual(0, before);
    Assert.isDefined(shown);
    Assert.isUndefined(fixture.electron.tray.shown);
    Assert.areEqual("/usr/bin/gdbus", fixture.process.programs.starts[0]?.file);
  }

  @TestMethod
  public async showsOnLinuxOnceTheSettingTurnsOnAfterAHostAppearedWhileItWasOff(): Promise<void> {
    const fixture = new TrayFixture("linux");
    fixture.connection.answers.set("shell.readSetting", Response.success("r", { name: "shell.trayIcon", value: false, isSet: true }));
    await fixture.startAsync();

    await fixture.process.programs.answerAsync("(<true>,)\n");
    const whileOff = fixture.electron.tray.trays.length;
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: true });

    Assert.areEqual(0, whileOff);
    Assert.areEqual(DesktopStartFixture.icon("tray/tray-idle.png"), fixture.tray.images.at(-1));
  }

  @TestMethod
  public async startsFromTheSettingLastHeardOnThisDeviceAndRemembersEachChange(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.files.state.kept = { trayCloseHintShown: true, trayIcon: false };
    const answer = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("shell.readSetting", () => answer.promise);
    await fixture.startAsync();

    const beforeAnswer = fixture.electron.tray.trays.length;
    answer.resolve(Response.success("r", { name: "shell.trayIcon", value: true, isSet: false }));
    await Condition.waitAsync(() => fixture.files.state.writes.length > 0);
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    await Condition.waitAsync(() => fixture.files.state.writes.length > 1);

    Assert.areEqual(0, beforeAnswer);
    Assert.areEqual(1, fixture.electron.tray.trays.length);
    Assert.isUndefined(fixture.electron.tray.shown);
    Assert.areEqual(JSON.stringify([{ trayCloseHintShown: true, trayIcon: true }, { trayCloseHintShown: true, trayIcon: false }]), JSON.stringify(fixture.files.state.writes));
  }

  @TestMethod
  public async ignoresARememberedSettingThatIsNotOnOrOff(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.files.state.kept = { trayIcon: "on" };
    const answer = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("shell.readSetting", () => answer.promise);
    await fixture.startAsync();

    Assert.isDefined(fixture.electron.tray.shown);
    answer.resolve(Response.success("r", { name: "shell.trayIcon", value: true, isSet: false }));
    await setImmediate();
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    await Condition.waitAsync(() => fixture.files.state.writes.length === 1);

    Assert.areEqual(JSON.stringify([{ trayIcon: false }]), JSON.stringify(fixture.files.state.writes));
  }

  @TestMethod
  public async showsAgainWhenTheSettingIsResetToItsDefault(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();

    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    const hidden = fixture.electron.tray.shown;
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: false });

    Assert.isUndefined(hidden);
    Assert.areEqual(2, fixture.electron.tray.trays.length);
    Assert.isDefined(fixture.electron.tray.shown);
  }

  @TestMethod
  public async readsEverythingAgainOnTheNextReadyAndDropsWhatTheEarlierConnectionAnswersLate(): Promise<void> {
    const fixture = new TrayFixture("win32");
    const late = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("shell.work", () => late.promise);
    await fixture.startAsync();

    fixture.launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => fixture.launcher.connections[1]?.calls.includes("shell.readSetting") === true);
    late.resolve(Response.success("r", { descriptions: ["Build"], sequence: 9 }));
    await setImmediate();

    Assert.areEqual(JSON.stringify(["shell.notifications", "shell.readSetting", "shell.work"]),
      JSON.stringify(fixture.launcher.connections[1]?.calls.filter(t => ["shell.work", "shell.notifications", "shell.readSetting"].includes(t)).sort()));
    Assert.isFalse(fixture.tray.images.includes(DesktopStartFixture.icon("tray/tray-running.ico")));
    Assert.areEqual("TeamRun", fixture.tray.toolTips.at(-1));
  }

  @TestMethod
  public async showsNoIconOnceTeamRunQuitsEvenWhenTheSettingTurnsOnAfterwards(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("shell.readSetting", Response.success("r", { name: "shell.trayIcon", value: false, isSet: true }));
    await fixture.startAsync();

    fixture.electron.app.emit("will-quit");
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: true, isSet: true });

    Assert.areEqual(1, fixture.electron.tray.trays.length);
    Assert.isUndefined(fixture.electron.tray.shown);
  }

  @TestMethod
  public async triesAgainOnLinuxWhenATrayHostAppearsAfterTheIconFailedToShow(): Promise<void> {
    const fixture = new TrayFixture("linux");
    fixture.electron.tray.failure = new Error("The tray host refused the icon.");
    await fixture.startAsync();

    await fixture.process.programs.answerAsync("(<true>,)\n");
    const failed = fixture.electron.tray.trays.length;
    fixture.electron.tray.failure = null;
    fixture.process.programs.output("StatusNotifierHostUnregistered");
    await fixture.process.programs.answerAsync("(<false>,)\n");
    fixture.process.programs.output("StatusNotifierHostRegistered");
    await fixture.process.programs.answerAsync("(<true>,)\n");

    Assert.areEqual(0, failed);
    Assert.isDefined(fixture.electron.tray.shown);
    Assert.areEqual(1, DesktopStartFixture.readErrors(fixture.process, "The tray icon could not be shown: Error: The tray host refused the icon.").length);
  }

  @TestMethod
  public async tellsItsTrustedWindowsWhetherATrayHostCanShowTheIcon(): Promise<void> {
    const linux = new TrayFixture("linux");
    await linux.startAsync();
    const windows = new TrayFixture("win32");
    await windows.startAsync();
    const event = DesktopStartFixture.trustedEvent("linux");
    const window = DesktopStartFixture.firstWindow(linux.electron);

    const before = linux.electron.ipcMain.invoke("teamrun:readTrayAvailable", event);
    await linux.process.programs.answerAsync("(<true>,)\n");
    const after = linux.electron.ipcMain.invoke("teamrun:readTrayAvailable", event);
    const untrusted = linux.electron.ipcMain.invoke("teamrun:readTrayAvailable", { ...event, senderFrame: null });
    linux.process.programs.output("StatusNotifierHostUnregistered");
    await linux.process.programs.answerAsync("(<false>,)\n");

    Assert.areEqual("[false,true,null,true]", JSON.stringify([before, after, untrusted, windows.electron.ipcMain.invoke("teamrun:readTrayAvailable", DesktopStartFixture.trustedEvent("win32"))]));
    Assert.areEqual(JSON.stringify([["teamrun:trayAvailable", true], ["teamrun:trayAvailable", false]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:trayAvailable")));
  }

  @TestMethod
  public async logsOnceWhenTheIconCannotShowAndTriesNoMore(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.tray.failure = new Error("The notification area is not available.");

    await fixture.startAsync();
    fixture.send("work", { descriptions: ["Build"], sequence: 1 });

    Assert.areEqual(0, fixture.electron.tray.trays.length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(fixture.process, "The tray icon could not be shown: Error: The notification area is not available.").length);
  }

  @TestMethod
  public async showsIdleWhileTheRuntimeIsAwayAndRemovesItsIconAndStopsWatchingWhenTeamRunQuits(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    fixture.send("work", { descriptions: ["Build"], sequence: 1 });
    const running = fixture.tray.images.at(-1);

    fixture.launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => fixture.tray.images.at(-1) === DesktopStartFixture.icon("tray/tray-idle.png"));
    const tray = fixture.tray;
    fixture.electron.app.emit("will-quit");

    Assert.areEqual(DesktopStartFixture.icon("tray/tray-running.png"), running);
    Assert.isTrue(tray.isDestroyed);
    Assert.areEqual(1, fixture.process.programs.stops);
  }

  @TestMethod
  public async asksAgainWhenTheLinuxTrayHostMonitorEndsAndRemovesTheIconWhenTheHostIsGone(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    const shown = fixture.electron.tray.shown;

    fixture.process.programs.exit();
    await fixture.process.programs.answerAsync("(<false>,)\n");

    Assert.isDefined(shown);
    Assert.isTrue(shown?.isDestroyed === true);
    Assert.isUndefined(fixture.electron.tray.shown);
    Assert.areEqual(2, fixture.process.programs.runs.length);
  }
}
