/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Event, Failure, FailureCode, NotificationBroadcast, PreShellData, QualifiedName, RecentCommands, Response, RuntimeHandover, ShellEvents, UpdateProcess, UpdateReady, UpdateSaved } from "@noldova/teamrun-shell-protocol";
import {
  ConnectionException, DataDirectory, DataDirectoryLocator, DeviceFolder, Installation, PreShellDataFoundException, ProcessPresence, ProductInfo, RuntimeBuild, RuntimeEntry, RuntimeHandoverException, SystemCommand, UpdateBarrier,
  RuntimeDiscovery, UpdateBarrierState, UpdateBarrierStatus, UpdateInProgressException
} from "@noldova/teamrun-shell-runtime";
import { type IIpcEvent, PathCommandException, PathCommandOutcome, UnusableFolderException, UpdateException, UpdateHandoffException } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FailingFileCallFixture } from "../fixtures/failing-file-call.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import type { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDeviceFiles } from "../fixtures/fake-device-files.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakePathCommand } from "../fixtures/fake-path-command.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";
import { FakeUpdateCheckLock } from "../fixtures/fake-update-check-lock.fixture.js";
import { FakeUpdateHandoff } from "../fixtures/fake-update-handoff.fixture.js";
import { FakeUpdater } from "../fixtures/fake-updater.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class DesktopApplicationTests {
  private static readonly IF_IDLE: object = { policy: "IfIdle", keepsWhileShared: true };
  private static readonly NOTIFICATION_METHODS: readonly string[] = [
    "shell.notifications", "shell.postNotification", "shell.updateNotification", "shell.dismissNotification", "shell.markNotificationsRead", "shell.clearNotifications"
  ];

  @TestMethod
  public namesItselfAndKeepsOneInstanceInTheSandbox(): void {
    const electron = new FakeElectron();

    DesktopStartFixture.start(electron, new FakeDesktopProcess("win32"));

    Assert.areEqual(
      JSON.stringify(["setName TeamRun", `setAppUserModelId ${DesktopStartFixture.DEVELOPMENT_APP_ID}`, "requestSingleInstanceLock", "enableSandbox"]),
      JSON.stringify(electron.app.calls.filter(t => !t.startsWith("setPath"))));
    Assert.areEqual(0, electron.windows.length);
  }

  @TestMethod
  public async quitsWhenAnotherInstanceRuns(): Promise<void> {
    const electron = new FakeElectron(false);

    DesktopStartFixture.start(electron, new FakeDesktopProcess("win32"));
    await electron.app.becomeReadyAsync();

    Assert.areEqual(
      JSON.stringify(["setName TeamRun", `setAppUserModelId ${DesktopStartFixture.DEVELOPMENT_APP_ID}`, "requestSingleInstanceLock", "quit"]), JSON.stringify(electron.app.calls.filter(t => !t.startsWith("setPath"))));
    Assert.areEqual(0, electron.app.count("window-all-closed"));
    Assert.areEqual(0, electron.windows.length);
  }

  @TestMethod
  public async opensItsWindowNoLargerThanNineTenthsOfASmallPrimaryDisplay(): Promise<void> {
    const electron = new FakeElectron();
    electron.screen.primaryWorkArea = { x: 0, y: 25, width: 1024, height: 743 };

    await DesktopStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(), electron);
    const window = DesktopStartFixture.firstWindow(electron);

    Assert.areEqual("921,668", [window.options.width, window.options.height].join(","));
  }

  @TestMethod
  public async deniesEveryPermission(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");

    Assert.isTrue(electron.defaultSession.request("media") === false);
    Assert.isTrue(electron.defaultSession.check() === false);
  }

  @TestMethod
  public async showsTheWindowInTheAppearanceItsPageReports(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async showsTheWindowWithoutAnAppearanceItCannotUse(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), { background: "red" });
    await Condition.waitAsync(() => window.isShown);

    Assert.isNull(window.backgroundColor);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify(["The window reported an appearance that is not valid, so it is shown without it: JsonException: $.titleBar: The field is required."]),
      JSON.stringify(DesktopStartFixture.readErrors(process, "The window reported")));
  }

  @TestMethod
  public async runsNoMenuRowOnceItsWindowHasClosed(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("darwin");
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:menuBar", DesktopStartFixture.trustedEvent("darwin"),
      { menus: [{ place: "shell.file", title: "File", rows: [{ type: "Command", id: "shell.file/shell.close/0", label: "Close the tab", key: null, enabled: true, check: "None", checked: false }] }] });
    const file = electron.menu.templates.at(-1)?.[1]?.submenu;

    window.destroy();
    Assert.isTrue(Array.isArray(file));
    DesktopStartFixture.click(file[0]);

    Assert.areEqual(0, window.webContents.sent.filter(t => t[0] === "teamrun:menuCommand").length);
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("win32", true)
  @TestData("darwin", false)
  public async leavesTheMenuBarAloneOnWindowsAndLinuxAndForAnotherSender(platform: string, isTrusted: boolean): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync(platform);
    const built = electron.menu.templates.length;

    electron.ipcMain.send("teamrun:menuBar", isTrusted ? DesktopStartFixture.trustedEvent(platform) : { sender: { id: 1 }, senderFrame: null }, { menus: [] });

    Assert.areEqual(built, electron.menu.templates.length);
  }

  @TestMethod
  public async keepsTheWindowHiddenWhenAChangedAppearanceComesBeforeTheFirstOne(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:appearance", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.isFalse(window.isShown);
  }

  @TestMethod
  public async keepsTheWindowsColorsWhenAChangedAppearanceCannotBeUsed(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);

    electron.ipcMain.send("teamrun:appearance", DesktopStartFixture.trustedEvent("linux"), { background: "red" });

    Assert.areEqual("#181818", window.backgroundColor);
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The window reported").length);
  }

  @TestMethod
  public async ignoresMessagesFromFramesItDoesNotTrust(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);
    const windowUrl = DesktopStartFixture.settings("linux").windowUrl;
    const untrusted: IIpcEvent[] = [
      { sender: { id: 1 }, senderFrame: null },
      { sender: { id: 1 }, senderFrame: { url: windowUrl, parent: {} } },
      { sender: { id: 1 }, senderFrame: { url: "https://example.com/", parent: null } },
      { sender: { id: 7 }, senderFrame: { url: windowUrl, parent: null } }
    ];

    for (const event of untrusted) {
      electron.ipcMain.send("teamrun:ready", event, DesktopStartFixture.APPEARANCE);
      electron.ipcMain.send("teamrun:appearance", event, DesktopStartFixture.APPEARANCE);
      Assert.isFalse(electron.ipcMain.invoke("teamrun:closeAnswer", event, "request", true) === true);
    }

    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.isNull(window.backgroundColor);
  }

  @TestMethod
  public async closesOnlyAfterThePageSaysItSaved(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    window.close();
    window.close();
    await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 1);
    await setImmediate();
    const [request] = DesktopStartFixture.closeRequests(window);

    Assert.areEqual(1, DesktopStartFixture.closeRequests(window).length);
    Assert.isFalse(window.isGone);
    Assert.isTrue(electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), request, true) === true);
    await Condition.waitAsync(() => window.isGone);
  }

  @TestMethod
  public async staysOpenWhenThePageKeepsUnsavedWork(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    window.close();
    await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.closeRequests(window)[0], false);
    await setImmediate();
    window.close();
    await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 2);

    Assert.isFalse(window.isGone);
    Assert.areEqual(2, DesktopStartFixture.closeRequests(window).length);
    window.destroy();
  }

  @TestMethod
  public async savesItsWindowThenAsksBeforeQuittingWithWorkInProgressAndQuitsOnceItHasFinished(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    DesktopApplicationTests.answerStops(connection, [DesktopApplicationTests.busy()]);
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);
    const event = DesktopStartFixture.trustedEvent("linux");
    DesktopApplicationTests.paint(electron, "linux", window);

    window.close();
    const stopsBeforeSaving = DesktopApplicationTests.stops(connection).length;
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);
    const untrusted = electron.ipcMain.invoke("teamrun:quitAnswer", { ...event, senderFrame: null }, "Wait");
    const waiting = electron.ipcMain.invoke("teamrun:quitAnswer", event, "Wait");
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: ["Indexing the project", "Saving the notes"], sequence: 2 }));
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: "Saving" }));
    const requestsWhileWorking = DesktopStartFixture.closeRequests(window).length;
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: [], sequence: 3 }));
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 2);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual("0,false,true,1", [stopsBeforeSaving, untrusted, waiting, requestsWhileWorking].join(","));
    Assert.areEqual(JSON.stringify([
      { descriptions: ["Indexing the project"], isWaiting: false, isUpdate: false },
      { descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false },
      { descriptions: ["Indexing the project", "Saving the notes"], isWaiting: true, isUpdate: false },
      null
    ]), JSON.stringify(DesktopApplicationTests.quitQuestions(window)));
    Assert.areEqual(2000, connection.timeouts[connection.calls.lastIndexOf("shell.work")]);
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE, DesktopApplicationTests.IF_IDLE]), JSON.stringify(DesktopApplicationTests.stops(connection)));
    Assert.isTrue(electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsAsItsQuitDoesWhenTheRuntimeAsksAndForwardsNothingToItsWindows(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);

    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));
    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await setImmediate();

    Assert.areEqual(1, DesktopStartFixture.closeRequests(window).length);
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE]), JSON.stringify(DesktopApplicationTests.stops(connection)));
    Assert.isFalse(connection.calls.includes("shell.quitAnswered"));
    Assert.isFalse(window.webContents.sent.some(t => t[1] === "shell.quitting"));
  }

  @TestMethod
  public async tellsTheRuntimeOnceItStayedWhenAWindowCannotSaveOrThePersonKeepsIt(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    DesktopApplicationTests.answerStops(connection, [DesktopApplicationTests.busy()]);
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);
    DesktopApplicationTests.paint(electron, "linux", window);

    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.closeRequests(window)[0], false);
    await Condition.waitAsync(() => connection.calls.includes("shell.quitAnswered"));
    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 2);
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);
    launcher.listener?.onEvent(new Event(ShellEvents.quitting, null));
    electron.ipcMain.invoke("teamrun:quitAnswer", DesktopStartFixture.trustedEvent("linux"), "Cancel");
    await Condition.waitAsync(() => connection.calls.filter(t => t === "shell.quitAnswered").length === 2);
    await setImmediate();

    Assert.areEqual("[{\"answer\":\"SaveFailed\"},{\"answer\":\"Stayed\"}]", JSON.stringify(connection.payloads.filter((_t, u) => connection.calls[u] === "shell.quitAnswered")));
    Assert.isFalse(window.isGone);
    Assert.isFalse(electron.app.calls.includes("quit"));
    window.destroy();
  }

  @TestMethod
  public async savesAgainBeforeStoppingTheWorkWhenThePersonChoosesToAndStaysWhenTheyCancel(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    DesktopApplicationTests.answerStops(connection, [
      DesktopApplicationTests.busy(), DesktopApplicationTests.busy(), Response.failure("r", new Failure(FailureCode.Internal, "The runtime is already stopping."))
    ]);
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    const event = DesktopStartFixture.trustedEvent("linux");
    DesktopApplicationTests.paint(electron, "linux", window);

    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);
    electron.ipcMain.invoke("teamrun:quitAnswer", event, "Cancel");
    await setImmediate();
    const isOpenAfterCancelling = !window.isGone && DesktopStartFixture.closeRequests(window).length === 1;
    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 2);
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 3);
    electron.ipcMain.invoke("teamrun:quitAnswer", event, "Stop");
    await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 3);
    const stopsBeforeSaving = DesktopApplicationTests.stops(connection).length;
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 3);
    await Condition.waitAsync(() => window.isGone);

    Assert.isTrue(isOpenAfterCancelling);
    Assert.areEqual(2, stopsBeforeSaving);
    Assert.areEqual(JSON.stringify({ policy: "StopWork", keepsWhileShared: true }), JSON.stringify(DesktopApplicationTests.stops(connection).at(-1)));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The runtime could not be stopped as TeamRun quits: The runtime is already stopping.").length);
    Assert.isTrue(electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsWithoutAskingWhenTheRuntimeIsKeptForAnotherClientOrStopsWhileIdle(): Promise<void> {
    const kept = new FakeRuntimeConnection();
    kept.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    kept.answers.set("shell.stop", Response.success("r", { keptFor: 1 }));
    const shared = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(kept));
    const idle = new FakeRuntimeConnection();
    const alone = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(idle));
    const first = DesktopStartFixture.firstWindow(shared);
    const second = DesktopStartFixture.firstWindow(alone);

    first.close();
    second.close();
    await DesktopStartFixture.answerSaveAsync(shared, "linux", first, 1);
    await DesktopStartFixture.answerSaveAsync(alone, "linux", second, 1);
    await Condition.waitAsync(() => first.isGone && second.isGone);

    Assert.areEqual(0, DesktopApplicationTests.quitQuestions(first).length + DesktopApplicationTests.quitQuestions(second).length);
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE]), JSON.stringify(DesktopApplicationTests.stops(kept)));
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE]), JSON.stringify(DesktopApplicationTests.stops(idle)));
    Assert.isTrue(shared.app.calls.includes("quit") && alone.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsWithoutAskingWhenTheWorkCannotBeReadInTimeOrTheRuntimeLeavesWhileItAsks(): Promise<void> {
    const slow = new FakeRuntimeConnection();
    slow.deferred.set("shell.work", () => Promise.reject(new ConnectionException("The runtime did not answer shell.work in time.")));
    slow.answers.set("shell.stop", DesktopApplicationTests.busy());
    const process = new FakeDesktopProcess("linux");
    const unanswered = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(slow), new FakeElectron(), new FakeDeviceIdentity(), process);
    const busy = new FakeRuntimeConnection();
    busy.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    busy.answers.set("shell.stop", DesktopApplicationTests.busy());
    const launcher = new FakeRuntimeLauncher(busy, new Promise<FakeRuntimeConnection>(() => undefined));
    const leaving = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const first = DesktopStartFixture.firstWindow(unanswered);
    const second = DesktopStartFixture.firstWindow(leaving);
    DesktopApplicationTests.paint(unanswered, "linux", first);
    DesktopApplicationTests.paint(leaving, "linux", second);

    first.close();
    await DesktopStartFixture.answerSaveAsync(unanswered, "linux", first, 1);
    await DesktopStartFixture.answerSaveAsync(unanswered, "linux", first, 2);
    await Condition.waitAsync(() => first.isGone);
    second.close();
    await DesktopStartFixture.answerSaveAsync(leaving, "linux", second, 1);
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(second).length === 1);
    launcher.listener?.onDisconnected(null);
    await DesktopStartFixture.answerSaveAsync(leaving, "linux", second, 2);
    await Condition.waitAsync(() => second.isGone);

    Assert.areEqual(0, DesktopApplicationTests.quitQuestions(first).length);
    Assert.areEqual(2000, slow.timeouts[slow.calls.lastIndexOf("shell.work")]);
    Assert.areEqual(
      1,
      DesktopStartFixture.readErrors(process, "The runtime's work could not be read before quitting, so TeamRun quits without asking: ConnectionException: The runtime did not answer shell.work in time.").length);
    Assert.areEqual("null", JSON.stringify(DesktopApplicationTests.quitQuestions(second).at(-1)));
    Assert.areEqual(1, DesktopApplicationTests.stops(busy).length);
  }

  @TestMethod
  public async quitsWithoutAskingWhileNoRuntimeIsConnectedOrWhenItCannotBeStoppedOrItsWorkCannotBeRead(): Promise<void> {
    const connecting = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise<FakeRuntimeConnection>(() => undefined)));
    const failing = new FakeRuntimeConnection();
    failing.answers.set("shell.stop", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is stopping.")));
    const process = new FakeDesktopProcess("linux");
    const refused = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(failing), new FakeElectron(), new FakeDeviceIdentity(), process);
    const unread = new FakeRuntimeConnection();
    unread.answers.set("shell.stop", DesktopApplicationTests.busy());
    const unreadable = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(unread));
    const going = new FakeRuntimeConnection();
    const launcher = new FakeRuntimeLauncher(going, new Promise<FakeRuntimeConnection>(() => undefined));
    going.deferred.set("shell.stop", () => {
      launcher.listener?.onDisconnected(null);
      return Promise.resolve(DesktopApplicationTests.busy());
    });
    const gone = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const apps = [connecting, refused, unreadable, gone];
    const windows = apps.map(t => DesktopStartFixture.firstWindow(t));
    unread.answers.set("shell.work", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is stopping.")));

    for (const app of apps) {
      const window = DesktopStartFixture.firstWindow(app);
      DesktopApplicationTests.paint(app, "linux", window);
      window.close();
      await DesktopStartFixture.answerSaveAsync(app, "linux", window, 1);
    }
    await DesktopStartFixture.answerSaveAsync(unreadable, "linux", DesktopStartFixture.firstWindow(unreadable), 2);
    await DesktopStartFixture.answerSaveAsync(gone, "linux", DesktopStartFixture.firstWindow(gone), 2);
    await Condition.waitAsync(() => windows.every(t => t.isGone));

    Assert.areEqual(0, windows.map(t => DesktopApplicationTests.quitQuestions(t).length).reduce((t, u) => t + u, 0));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The runtime could not be stopped as TeamRun quits: The runtime is stopping.").length);
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE, DesktopApplicationTests.IF_IDLE]), JSON.stringify(DesktopApplicationTests.stops(unread)));
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE]), JSON.stringify(DesktopApplicationTests.stops(going)));
    Assert.isTrue(apps.every(t => t.app.calls.includes("quit")));
  }

  @TestMethod
  public async closesIntoTheTrayWhileItsIconShowsAndSaysSoOnceWithoutQuitting(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.files.state.readFailure = new SyntaxError("Unexpected end of JSON input");
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);

    window.close();
    const hintsBeforeSaving = fixture.electron.notifications.created.length;
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone && fixture.files.state.writes.length === 1);
    const [hint] = fixture.electron.notifications.created;
    hint?.click();
    const reopened = fixture.electron.windows[1];
    reopened?.close();
    if (!Object.isUndefined(reopened))
      await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", reopened, 1);
    await Condition.waitAsync(() => reopened?.isGone === true);

    Assert.areEqual(0, hintsBeforeSaving);
    Assert.areEqual(JSON.stringify(["TeamRun is still running", "Open it again or quit it from its icon in the notification area.", true]),
      JSON.stringify([hint?.title, hint?.options.body, hint?.isShown]));
    Assert.areEqual(1, fixture.electron.notifications.created.length);
    Assert.areEqual(JSON.stringify([{ trayCloseHintShown: true }]), JSON.stringify(fixture.files.state.writes));
    Assert.areEqual(1, DesktopStartFixture.readErrors(fixture.process, "The device's state could not be read, so its hints count as not shown and the tray icon follows its default until the runtime answers: SyntaxError: Unexpected end of JSON input").length);
    Assert.isFalse(fixture.electron.app.calls.some(t => t.startsWith("quit")));
    Assert.isFalse(fixture.connection.calls.includes("shell.stop"));
  }

  @TestMethod
  public async closesIntoTheTrayWithoutRecordingTheHintWhereNotificationsCannotShow(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.notifications.isSupportedNow = false;
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);
    const checksBeforeClosing = fixture.electron.notifications.supportChecks;

    window.close();
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone && fixture.electron.notifications.supportChecks > checksBeforeClosing);

    Assert.areEqual(0, fixture.electron.notifications.created.length + fixture.files.state.writes.length);
    Assert.isFalse(fixture.electron.app.calls.some(t => t.startsWith("quit")));
  }

  @TestMethod
  public async logsATrayHintTheSystemRefusesAndRecordsNothingForTheRestOfTheRun(): Promise<void> {
    const fixture = new TrayFixture("linux");
    fixture.electron.notifications.refusal = "Notifications are turned off.";
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    const window = DesktopStartFixture.firstWindow(fixture.electron);
    window.close();
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone && DesktopStartFixture.readErrors(fixture.process, "The operating system did not show").length === 1);

    fixture.electron.notifications.refusal = null;
    fixture.tray.click();
    const reopened = fixture.electron.windows[1];
    reopened?.close();
    if (!Object.isUndefined(reopened))
      await DesktopStartFixture.answerSaveAsync(fixture.electron, "linux", reopened, 1);
    await Condition.waitAsync(() => reopened?.isGone === true);

    Assert.areEqual(JSON.stringify(["The operating system did not show the hint that TeamRun is still running, so it counts as not shown: Notifications are turned off."]),
      JSON.stringify(DesktopStartFixture.readErrors(fixture.process, "The operating system did not show")));
    Assert.areEqual(JSON.stringify([["Open it again or quit it from its icon in the tray.", false]]),
      JSON.stringify(fixture.electron.notifications.created.map(t => [t.options.body, t.isShown])));
    Assert.isFalse(fixture.files.state.writes.some(t => Object.hasOwn(t, "trayCloseHintShown")));
  }

  @TestMethod
  public async opensAWindowWhenStartedAgainWhileInTheTray(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    const window = DesktopStartFixture.firstWindow(fixture.electron);
    window.close();
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);

    fixture.electron.app.emit("second-instance");
    fixture.electron.app.emit("second-instance");

    Assert.areEqual(2, fixture.electron.windows.length);
    Assert.areEqual(false, fixture.electron.windows[1]?.isGone);
  }

  @TestMethod
  public async opensNoWindowWhenStartedAgainBeforeItsLaunchBarrierIsChecked(): Promise<void> {
    const electron = new FakeElectron();
    DesktopStartFixture.start(electron, new FakeDesktopProcess("linux"));
    await electron.app.becomeReadyAsync();

    electron.app.emit("second-instance");
    const whileChecking = electron.windows.length;
    await Condition.waitAsync(() => electron.windows.length > 0);
    electron.app.emit("second-instance");

    Assert.areEqual(0, whileChecking);
    Assert.areEqual(1, electron.windows.length);
  }

  @TestMethod
  public async opensNoWindowFromTheHintTheIconOrAnotherStartWhileAQuitRunsOrOnceItExits(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);
    window.close();
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone && fixture.electron.notifications.created.length === 1);
    const stopping = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("shell.stop", () => stopping.promise);

    fixture.click("Quit TeamRun");
    await Condition.waitAsync(() => fixture.connection.calls.includes("shell.stop"));
    fixture.electron.notifications.created[0]?.click();
    fixture.electron.app.emit("second-instance");
    fixture.click("Open TeamRun");
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });
    const windowsWhileQuitting = fixture.electron.windows.length;
    stopping.resolve(Response.success("r", null));
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));
    fixture.electron.notifications.created[0]?.click();
    fixture.electron.app.emit("second-instance");

    Assert.areEqual(1, windowsWhileQuitting);
    Assert.areEqual(1, fixture.electron.windows.length);
  }

  @TestMethod
  public async showsNoTrayHintForAWindowThatClosesWhileAQuitRuns(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);
    const stopping = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("shell.stop", () => stopping.promise);

    fixture.click("Quit TeamRun");
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => fixture.connection.calls.includes("shell.stop"));
    window.destroy();
    await setImmediate();
    const hintsWhileQuitting = fixture.electron.notifications.created.length;
    stopping.resolve(Response.success("r", null));
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));

    Assert.areEqual(0, hintsWhileQuitting);
    Assert.areEqual(0, fixture.electron.notifications.created.length);
    Assert.isFalse(fixture.files.state.writes.some(t => Object.hasOwn(t, "trayCloseHintShown")));
  }

  @TestMethod
  public async opensNoWindowFromTheDockWhileAQuitRunsOnMacOS(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const stopping = Promise.withResolvers<Response>();
    connection.deferred.set("shell.stop", () => stopping.promise);
    const electron = await DesktopStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(connection));
    const window = DesktopStartFixture.firstWindow(electron);
    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "darwin", window, 1);
    await Condition.waitAsync(() => window.isGone);

    electron.app.quit();
    await Condition.waitAsync(() => connection.calls.includes("shell.stop"));
    electron.app.emit("activate");
    const windowsWhileQuitting = electron.windows.length;
    stopping.resolve(Response.success("r", null));
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));
    electron.app.emit("activate");

    Assert.areEqual(1, windowsWhileQuitting);
    Assert.areEqual(1, electron.windows.length);
  }

  @TestMethod
  public async opensAWindowWhenTheTrayIconGoesAwayWhileNoWindowIsOpen(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);

    window.close();
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);
    const windowsInTray = fixture.electron.windows.length;
    fixture.send("settingsChanged", { name: "shell.trayIcon", device: FakeDeviceIdentity.ID, value: false, isSet: true });

    Assert.areEqual(1, windowsInTray);
    Assert.areEqual(2, fixture.electron.windows.length);
    Assert.isUndefined(fixture.electron.tray.shown);
  }

  @TestMethod
  public async asksInANewWindowOnceItHasPaintedWhenQuitFromTheTrayWithWorkAndNoWindowOpen(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    DesktopApplicationTests.answerStops(fixture.connection, [DesktopApplicationTests.busy()]);
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);
    window.close();
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);

    fixture.click("Quit TeamRun");
    await Condition.waitAsync(() => fixture.electron.windows.length === 2);
    const asking = fixture.electron.windows[1];
    Assert.isDefined(asking);
    await setImmediate();
    const questionsBeforePaint = DesktopApplicationTests.quitQuestions(asking).length;
    fixture.electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("win32", asking.id), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(asking).length === 1);
    fixture.electron.ipcMain.invoke("teamrun:quitAnswer", DesktopStartFixture.trustedEvent("win32", asking.id), "Stop");
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", asking, 1);
    await Condition.waitAsync(() => asking.isGone);

    Assert.areEqual(0, questionsBeforePaint);
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE, { policy: "StopWork", keepsWhileShared: true }]), JSON.stringify(DesktopApplicationTests.stops(fixture.connection)));
    Assert.isTrue(fixture.electron.app.calls.includes("quit"));
  }

  @TestMethod
  public async quitsWithoutAskingWhenTheWindowOpenedToAskClosesBeforeItPaints(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    DesktopApplicationTests.answerStops(fixture.connection, [DesktopApplicationTests.busy()]);
    await fixture.startAsync();
    const window = DesktopStartFixture.firstWindow(fixture.electron);
    window.close();
    await DesktopStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);

    fixture.click("Quit TeamRun");
    await Condition.waitAsync(() => fixture.electron.windows.length === 2);
    const asking = fixture.electron.windows[1];
    Assert.isDefined(asking);
    asking.destroy();
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));

    Assert.areEqual(0, DesktopApplicationTests.quitQuestions(asking).length);
    Assert.areEqual(JSON.stringify([DesktopApplicationTests.IF_IDLE, DesktopApplicationTests.IF_IDLE]), JSON.stringify(DesktopApplicationTests.stops(fixture.connection)));
  }

  @TestMethod
  public async keepsRunningOnMacOSWhenTheLastWindowClosesWithoutAHintAndQuitsWhenAsked(): Promise<void> {
    const files = new FakeDeviceFiles();
    const electron = await DesktopStartFixture.startReadyAsync("darwin", undefined, undefined, undefined, undefined, files);
    const window = DesktopStartFixture.firstWindow(electron);

    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "darwin", window, 1);
    await Condition.waitAsync(() => window.isGone);
    electron.app.emit("window-all-closed");
    const callsInBackground = electron.app.calls.filter(t => t.startsWith("quit")).length;
    electron.app.quit();
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));

    Assert.areEqual(0, callsInBackground);
    Assert.areEqual(0, electron.notifications.created.length);
    Assert.areEqual(JSON.stringify([{ trayIcon: true }]), JSON.stringify(files.state.writes));
  }

  @TestMethod
  public async logsAnUnexpectedStartFailureInFullAndShowsIt(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new TypeError("A defect.")), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = DesktopStartFixture.trustedEvent("linux");

    await Condition.waitAsync(() => process.errors.includes("so the window offers to try again"));

    Assert.isTrue(process.errors.includes("The runtime could not be started or reached, so the window offers to try again: TypeError: A defect."));
    Assert.isTrue(process.errors.includes("desktop-application.test"), "the log keeps the error's stack");
    Assert.areEqual(JSON.stringify({ kind: "Failed", details: ["TypeError: A defect."] }), JSON.stringify(electron.ipcMain.invoke("teamrun:readStartup", event)));
  }

  @TestMethod
  public async writesItsOwnWindowsModuleLinesToItsLogUnderTheModulesId(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = DesktopStartFixture.trustedEvent("linux");

    electron.ipcMain.send("teamrun:moduleLog", event, "notes", "Opened the list\r\nwith 3 notes\r2026-10-04T12:00:00.000Z shell: \u001b[1mfaked\n");
    electron.ipcMain.send("teamrun:moduleLog", { ...event, senderFrame: null }, "notes", "Untrusted");
    electron.ipcMain.send("teamrun:moduleLog", event, "Notes", "Not an id");
    electron.ipcMain.send("teamrun:moduleLog", event, 7, "Not text");
    electron.ipcMain.send("teamrun:moduleLog", event, "notes", 7);
    electron.ipcMain.send("teamrun:moduleLog", event, "notes", `${"a ".repeat(32_767)}ab left out`);

    Assert.areEqual(JSON.stringify(["notes: Opened the list", "notes: with 3 notes", "notes: 2026-10-04T12:00:00.000Z shell: [1mfaked", `notes: ${"a ".repeat(32_767)}ab`]),
      JSON.stringify(process.errors.split("\n").filter(t => t.includes("notes: ")).map(t => t.slice(t.indexOf("notes: ")))));
    Assert.areEqual(0, process.errors.split("\n").filter(t => t.includes("Untrusted") || t.includes("Not ")).length);
  }

  @TestMethod
  public async writesItsOwnWindowsErrorsToItsLogRedactedAndUnderTheModulesIdWhenThereIsOne(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = DesktopStartFixture.trustedEvent("linux");

    electron.ipcMain.send("teamrun:windowError", event, null,
      `Error: The layout could not be saved.\u20282026-10-04T12:00:00.000Z Faked record\n    at save (${process.homeFolder}/teamrun/window.js:1:2)\n`);
    electron.ipcMain.send("teamrun:windowError", event, "clock", "Error: Its window part failed to activate.");
    electron.ipcMain.send("teamrun:windowError", { ...event, senderFrame: null }, null, "Untrusted");
    electron.ipcMain.send("teamrun:windowError", event, "Clock", "Not an id");
    electron.ipcMain.send("teamrun:windowError", event, 7, "Not an id either");
    electron.ipcMain.send("teamrun:windowError", event, null, 7);
    electron.ipcMain.send("teamrun:windowError", event, null, `${"a ".repeat(32_767)}ab left out`);

    const lines = process.errors.split("\n").filter(t => t.includes("Window error")).map(t => t.slice(t.indexOf("Window error")));
    Assert.areEqual(JSON.stringify([
      "Window error: Error: The layout could not be saved.",
      "Window error: 2026-10-04T12:00:00.000Z Faked record",
      "Window error:     at save (~/teamrun/window.js:1:2)",
      "Window error in clock: Error: Its window part failed to activate.",
      `Window error: ${"a ".repeat(32_767)}ab`
    ]), JSON.stringify(lines));
    Assert.areEqual(0, process.errors.split("\n").filter(t => t.includes("Untrusted") || t.includes("Not an id")).length);
  }

  @TestMethod
  public async writesTenErrorsFromAWindowThenOneNoticeAndLeavesOutTheRestOfTheMinute(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const event = DesktopStartFixture.trustedEvent("linux");

    electron.ipcMain.send("teamrun:windowError", event, "Clock", "Not counted");
    for (let index = 0; index < 12; index++)
      electron.ipcMain.send("teamrun:windowError", event, null, `Error ${index}`);

    const lines = process.errors.split("\n").filter(t => t.includes("Window error") || t.includes("errors are left out")).map(t => t.slice(t.indexOf(" ") + 1));
    Assert.areEqual(JSON.stringify([
      ...Array.from({ length: 10 }, (_, index) => `Window error: Error ${index}`),
      "The window reported more than ten errors within a minute; the rest of that minute's errors are left out of the log."
    ]), JSON.stringify(lines));
  }

  @TestMethod
  public async stopsWaitingForAWindowThatIsGone(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    window.close();
    window.destroy();
    await setImmediate();

    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async sendsNoCloseRequestToAWindowThatIsGone(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    window.isGone = true;
    window.close();
    await setImmediate();

    Assert.areEqual(0, DesktopStartFixture.closeRequests(window).length);
    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async quitsWhenTheLastWindowClosesWithoutATrayIcon(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");

    DesktopStartFixture.firstWindow(electron).destroy();
    electron.app.emit("window-all-closed");
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));

    Assert.areEqual("quit prevented", electron.app.calls.at(-2));
  }

  @TestMethod
  public async bringsItsWindowForwardWhenStartedAgainAndLeavesAWindowNotShownYetToShowWhenReady(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    electron.app.emit("second-instance");
    const beforeShown = [...window.calls];
    await DesktopStartFixture.showAsync(electron, "linux", window);
    electron.app.emit("second-instance");
    window.isMinimizedNow = true;
    electron.app.emit("second-instance");

    Assert.areEqual(0, beforeShown.length);
    Assert.areEqual(JSON.stringify(["show", "focus", "restore", "focus"]), JSON.stringify(window.calls.filter(t => ["show", "focus", "restore"].includes(t))));
  }

  @TestMethod
  public async givesItsLauncherTheInstallationInTheDeviceFolderItIsGiven(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const installations: Installation[] = [];
      DesktopStartFixture.start(
        new FakeElectron(), new FakeDesktopProcess(process.platform, [`--device-dir=${folder}`], environment), undefined, undefined, undefined, undefined, installations);
      const [installation] = installations;
      Assert.isDefined(installation);
      const [holder] = await ProcessPresence.create(process.platform, new SystemCommand()).stampAsync([[process.pid, "desktop"]]);
      Assert.isDefined(holder);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing, null).toJson()));

      const status = await installation.checkAsync(RuntimeBuild.identity.productVersion);

      Assert.areEqual(join(folder, "installations"), dirname(installation.folder));
      Assert.areEqual(UpdateBarrierStatus.Held, status);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async opensNoWindowAndExitsWhileAnotherDesktopInstallsAnUpdate(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      electron.dialog.answers.push(0);
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const installations: Installation[] = [];
      const launcher = new FakeRuntimeLauncher();
      DesktopStartFixture.start(electron, new FakeDesktopProcess(process.platform, [`--device-dir=${folder}`], environment), launcher, undefined, undefined, undefined, installations);
      const [installation] = installations;
      Assert.isDefined(installation);
      const [holder] = await ProcessPresence.create(process.platform, new SystemCommand()).stampAsync([[process.pid, "desktop"]]);
      Assert.isDefined(holder);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing, null).toJson()));

      await electron.app.becomeReadyAsync();
      electron.app.emit("activate");
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));
      electron.app.emit("activate");

      Assert.areEqual(0, electron.windows.length);
      Assert.areEqual(0, launcher.calls.length);
      Assert.areEqual(JSON.stringify(["TeamRun is installing an update."]), JSON.stringify(electron.dialog.boxes.map(t => t.options.message)));
      Assert.isTrue(existsSync(installation.barrierFile));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async removesABarrierAnUpdateLeftBeforeItsHandoffLogsItAndOpensItsWindow(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const desktop = new FakeDesktopProcess(process.platform, [`--device-dir=${folder}`], environment);
      const installations: Installation[] = [];
      DesktopStartFixture.start(electron, desktop, new FakeRuntimeLauncher(), undefined, undefined, undefined, installations);
      const [installation] = installations;
      Assert.isDefined(installation);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(new UpdateProcess(process.pid, 1, 2, "desktop"), "0.3.0", UpdateBarrierState.Closing, null).toJson()));

      await DesktopStartFixture.openAsync(electron);

      Assert.areEqual(0, electron.dialog.boxes.length);
      Assert.isFalse(existsSync(installation.barrierFile));
      Assert.areEqual(1, DesktopStartFixture.readErrors(desktop, "An update stopped before its handoff, so its launch barrier was removed.").length);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async quitsAndLogsWhenItCannotTellThePersonThatAnUpdateIsInstalling(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      electron.dialog.failure = new Error("No display");
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const desktop = new FakeDesktopProcess(process.platform, [`--device-dir=${folder}`], environment);
      const installations: Installation[] = [];
      DesktopStartFixture.start(electron, desktop, new FakeRuntimeLauncher(), undefined, undefined, undefined, installations);
      const [installation] = installations;
      Assert.isDefined(installation);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, "{\"holder\":");

      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(0, electron.windows.length);
      Assert.areEqual(1, DesktopStartFixture.readErrors(desktop, "The launch barrier could not be settled: Error: No display").length);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async quitsAndLogsWhenItCannotTellThePersonThatTheRuntimeStartFoundAnUpdate(): Promise<void> {
    const electron = new FakeElectron();
    electron.dialog.failure = new Error("No display");
    const process = new FakeDesktopProcess("linux");

    await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new UpdateInProgressException(UpdateBarrierStatus.Held)), electron, undefined, process);
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

    Assert.areEqual(1, electron.dialog.boxes.length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The launch barrier could not be settled: Error: No display").length);
  }

  @TestMethod
  public async savesEveryWindowForAnUpdateAndQuitsWhenAnotherDesktopClosesTheInstallation(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      const launcher = new FakeRuntimeLauncher();
      const installations: Installation[] = [];
      const environment = { SystemRoot: process.env["SystemRoot"] };
      const desktop = new FakeDesktopProcess(process.platform, [`--device-dir=${folder}`], environment);
      DesktopStartFixture.start(electron, desktop, launcher, undefined, undefined, undefined, installations);
      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => launcher.connections.length === 1);
      const [installation] = installations;
      Assert.isDefined(installation);
      const [coordinator] = await ProcessPresence.create(process.platform, new SystemCommand()).stampAsync([[process.pid, "desktop"]]);
      Assert.isDefined(coordinator);
      await mkdir(installation.folder, { recursive: true });
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(coordinator, "0.3.0", UpdateBarrierState.Preparing, null).toJson()));
      const window = DesktopStartFixture.firstWindow(electron);
      const event = DesktopStartFixture.trustedEvent(process.platform);

      launcher.listener?.onEvent(new Event(ShellEvents.updating, null));
      await Condition.waitAsync(() => window.webContents.sent.some(t => t[0] === "teamrun:updateSaveRequest"));
      const request = window.webContents.sent.find(t => t[0] === "teamrun:updateSaveRequest");
      const untrusted = electron.ipcMain.invoke("teamrun:updateSaveAnswer", { ...event, senderFrame: null }, request?.[1], []);
      const answered = electron.ipcMain.invoke("teamrun:updateSaveAnswer", event, request?.[1], ["Notes couldn't save"]);
      const connection = launcher.connections[0];
      await Condition.waitAsync(() => connection?.calls.includes("shell.updateSaved") === true);
      await writeFile(installation.barrierFile, JSON.stringify(new UpdateBarrier(coordinator, "0.3.0", UpdateBarrierState.Closing, null).toJson()));
      launcher.listener?.onDisconnected(null);
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.isTrue(window.webContents.sent.some(t => t[0] === "teamrun:startupState" && JSON.stringify(t[1]) === JSON.stringify({ kind: "Updating", details: ["0.3.0"] })));
      Assert.isFalse(untrusted === true);
      Assert.isTrue(answered === true);
      Assert.areEqual(JSON.stringify(new UpdateSaved(1000, ["Notes couldn't save"]).toJson()), JSON.stringify(connection?.payloads.at(-1)));
      Assert.areEqual(desktop.programs.starts.length, desktop.programs.stops);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async recordsItselfInItsInstallationAndLogsWhenItCannotButStartsAnyway(): Promise<void> {
    const recorded = await DesktopApplicationTests.startRecordingAsync(true);
    const notFound = await DesktopApplicationTests.startRecordingAsync(false);
    const failed = await DesktopApplicationTests.startRecordingAsync(new Error("EACCES: permission denied, mkdir"));

    Assert.areEqual(0, DesktopStartFixture.readErrors(recorded, "This desktop could not be recorded").length);
    Assert.areEqual(JSON.stringify(["This desktop could not be recorded in its installation, so an update may not wait for it: TeamRun could not find its own process in the process table."]),
      JSON.stringify(DesktopStartFixture.readErrors(notFound, "This desktop could not be recorded")));
    Assert.areEqual(JSON.stringify(["This desktop could not be recorded in its installation, so an update may not wait for it: Error: EACCES: permission denied, mkdir"]),
      JSON.stringify(DesktopStartFixture.readErrors(failed, "This desktop could not be recorded")));
  }

  @TestMethod
  public async opensItsWindowWithTheDevicesLastAppearanceAndKeepsTheOneItsWindowReports(): Promise<void> {
    const files = new FakeDeviceFiles();
    files.appearance.kept = { "shell.mode": "Dark" };
    const process = new FakeDesktopProcess("darwin", ["--device-dir=/devices/this"]);
    const electron = await DesktopStartFixture.startReadyAsync("darwin", undefined, undefined, undefined, process, files);
    const event = DesktopStartFixture.trustedEvent("darwin");

    electron.ipcMain.send("teamrun:keepAppearance", { sender: { id: 1 }, senderFrame: null }, { "shell.mode": "System" });
    electron.ipcMain.send("teamrun:keepAppearance", event, ["shell.mode"]);
    electron.ipcMain.send("teamrun:keepAppearance", event, { "shell.theme": "x".repeat(4100) });
    electron.ipcMain.send("teamrun:keepAppearance", event, { "shell.mode": "Light" });
    DesktopStartFixture.firstWindow(electron).destroy();
    electron.app.emit("activate");

    Assert.areEqual(JSON.stringify(["/devices/this", "appearance.json"]), JSON.stringify(files.created.find(t => t[1] === "appearance.json")));
    Assert.areEqual(JSON.stringify(["--teamrun-appearance={\"shell.mode\":\"Dark\"}"]), JSON.stringify(electron.windows[0]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify([{ "shell.mode": "Light" }]), JSON.stringify(files.appearance.writes));
    Assert.areEqual(JSON.stringify(["--teamrun-appearance={\"shell.mode\":\"Light\"}"]), JSON.stringify(electron.windows[1]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(2, DesktopStartFixture.readErrors(process, "The window's appearance preferences are not valid, so they are not kept").length);
  }

  @TestMethod
  public async opensItsWindowInTheDefaultAppearanceWhenTheLastOneCannotBeReadAndReportsOneItCannotKeep(): Promise<void> {
    const files = new FakeDeviceFiles();
    files.appearance.readFailure = new SyntaxError("Unexpected end of JSON input");
    files.appearance.writeFailure = new Error("The disk is full.");
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", undefined, undefined, undefined, process, files);

    electron.ipcMain.send("teamrun:keepAppearance", DesktopStartFixture.trustedEvent("linux"), { "shell.mode": "Dark" });
    await Condition.waitAsync(() => DesktopStartFixture.readErrors(process, "The device's appearance could not be kept").length > 0);

    Assert.areEqual(JSON.stringify([]), JSON.stringify(DesktopStartFixture.firstWindow(electron).options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify(["The device's last appearance could not be read, so the window starts in the default appearance: SyntaxError: Unexpected end of JSON input"]),
      JSON.stringify(DesktopStartFixture.readErrors(process, "The device's last appearance")));
    Assert.areEqual(JSON.stringify(["The device's appearance could not be kept for the next start: Error: The disk is full."]),
      JSON.stringify(DesktopStartFixture.readErrors(process, "The device's appearance could not be kept")));
  }

  @TestMethod
  public async opensOneWindowWhenActivatedBeforeItsLaunchBarrierIsChecked(): Promise<void> {
    const electron = new FakeElectron();
    DesktopStartFixture.start(electron, new FakeDesktopProcess("darwin"));
    await electron.app.becomeReadyAsync();

    electron.app.emit("activate");
    const whileChecking = electron.windows.length;
    await Condition.waitAsync(() => electron.windows.length > 0);
    electron.app.emit("activate");

    Assert.areEqual(0, whileChecking);
    Assert.areEqual(1, electron.windows.length);
  }

  @TestMethod
  public async opensAWindowWhenActivatedWithoutOne(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("darwin");

    electron.app.emit("activate");
    Assert.areEqual(1, electron.windows.length);
    DesktopStartFixture.firstWindow(electron).destroy();
    electron.app.emit("second-instance");
    electron.app.emit("activate");

    Assert.areEqual(2, electron.windows.length);
  }

  @TestMethod
  public keepsItsProfileInTheCheckoutsDataDirectoryAndRunsTheRuntimeUnderElectronsNode(): void {
    const electron = new FakeElectron();
    const process = new FakeDesktopProcess("linux", ["electron", "main.js"], { KEPT: "yes" });
    const checkout = join(dirname(fileURLToPath(DesktopStartFixture.MODULE_URL)), "..", "..", "..");
    const dataDirectory = DataDirectoryLocator.locate(false, {}, process.homeFolder, checkout);

    const [settings] = DesktopStartFixture.start(electron, process);

    Assert.areEqual(JSON.stringify([`setPath userData ${join(dataDirectory.root, "desktop")}`]), JSON.stringify(electron.app.calls.filter(t => t.startsWith("setPath"))));
    Assert.areEqual(dataDirectory.root, settings?.dataDirectory.root);
    Assert.areEqual(JSON.stringify(["/electron/electron", RuntimeEntry.entryPath, "linux"]), JSON.stringify([settings?.executablePath, settings?.entryPath, settings?.platform]));
    Assert.areEqual(JSON.stringify({ KEPT: "yes", ELECTRON_RUN_AS_NODE: "1" }), JSON.stringify(settings?.environment));
  }

  @TestMethod
  public usesTheDataDirectoryAndProfileItIsGiven(): void {
    const electron = new FakeElectron();
    const data = join(dirname(fileURLToPath(DesktopStartFixture.MODULE_URL)), "test-data");

    const [settings] = DesktopStartFixture.start(electron, new FakeDesktopProcess("linux", [`--data-dir=${data}`, "--user-data-dir=/profile"]));

    Assert.areEqual(data, settings?.dataDirectory.root);
    Assert.isTrue(electron.app.calls.every(t => !t.startsWith("setPath")));
  }

  @TestMethod
  public resolvesRelativeFoldersAgainstTheFolderItWasStartedInBeforeUsingThem(): void {
    const electron = new FakeElectron(true, true);
    const files = new FakeDeviceFiles();
    const process = new FakeDesktopProcess("linux", ["/opt/teamrun/teamrun", "--data-dir=data", "--device-dir=./device"]);

    const [settings] = DesktopStartFixture.start(electron, process, undefined, undefined, files);

    const data = join(process.workingDirectory, "data");
    Assert.areEqual(data, settings?.dataDirectory.root);
    Assert.areEqual(`setPath userData ${new DataDirectory(data).profileFolder}`, electron.app.calls.find(t => t.startsWith("setPath")));
    Assert.isTrue(files.created.length > 0 && files.created.every(([folder]) => folder.startsWith(join(process.workingDirectory, "device"))), JSON.stringify(files.created));
  }

  @TestMethod
  @TestData("/home/person/work", "/home/person/work")
  @TestData(null, null)
  public resolvesRelativeFoldersOfAnAppImageAgainstTheFolderItsLauncherWasStartedIn(startFolder: string | null, expected: string | null): void {
    const process = new FakeDesktopProcess("linux", ["/electron/electron", "--data-dir=data", "--device-dir=device"], {
      APPIMAGE: "/home/person/Applications/TeamRun.AppImage",
      APPDIR: "/electron",
      ...Object.isNull(startFolder) ? {} : { OWD: startFolder }
    });
    const files = new FakeDeviceFiles();

    const [settings] = DesktopStartFixture.start(new FakeElectron(true, true), process, undefined, undefined, files);

    const folder = expected ?? process.workingDirectory;
    Assert.areEqual(resolve(folder, "data"), settings?.dataDirectory.root);
    Assert.isTrue(files.created.length > 0 && files.created.every(([t]) => t.startsWith(resolve(folder, "device"))), JSON.stringify(files.created));
  }

  @TestMethod
  @TestData("--lang=en-US")
  @TestData("--data-dir=")
  @TestData("--data-dir= ")
  public keepsAPackagedBuildsDataInThePersonsDataDirectory(argument: string): void {
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("linux", [argument]);

    const [settings] = DesktopStartFixture.start(electron, process);

    Assert.areEqual(DataDirectoryLocator.locate(true, {}, process.homeFolder, "/unused").root, settings?.dataDirectory.root);
  }

  @TestMethod
  public treatsAStartThroughElectronsDefaultAppAsDevelopmentWhateverItsProgramIsCalled(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/teamrun/teamrun"));
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("win32");
    process.isDefaultApp = true;

    const [settings] = DesktopStartFixture.start(electron, process, new FakeRuntimeLauncher(handover));
    return DesktopStartFixture.openAsync(electron).then(async () => {
      await setImmediate();

      Assert.areEqual(DataDirectoryLocator.locate(false, {}, process.homeFolder, DesktopStartFixture.checkoutRoot()).root, settings?.dataDirectory.root);
      Assert.areEqual(DesktopStartFixture.DEVELOPMENT_APP_ID, DesktopStartFixture.firstWindow(electron).appDetails?.appId);
      Assert.areEqual(0, process.started.length);
      Assert.areEqual(JSON.stringify({ kind: "NewerBuild", details: ["2.0.0"] }), JSON.stringify(electron.ipcMain.invoke("teamrun:readStartup", DesktopStartFixture.trustedEvent("win32"))));
    });
  }

  @TestMethod
  @TestData("linux", true)
  @TestData("linux", false)
  @TestData("win32", true)
  @TestData("darwin", false)
  public namesItsDesktopFileOnLinuxAfterItsAppId(platform: string, isPackaged: boolean): void {
    const electron = new FakeElectron(true, isPackaged);
    const appId = isPackaged ? "com.noldova.teamrun" : DesktopStartFixture.DEVELOPMENT_APP_ID;

    DesktopStartFixture.start(electron, new FakeDesktopProcess(platform));

    Assert.areEqual(platform === "linux" ? `setDesktopName ${appId}.desktop` : "", electron.app.calls.filter(t => t.startsWith("setDesktopName")).join(","));
  }

  @TestMethod
  public tellsItsWindowHowStartingTheRuntimeGoes(): Promise<void> {
    return DesktopStartFixture.startReadyAsync("linux").then(electron => {
      const window = DesktopStartFixture.firstWindow(electron);

      Assert.areEqual(JSON.stringify([
        ["teamrun:startupState", { kind: "Connecting", details: [] }],
        ["teamrun:startupState", { kind: "Ready", details: [] }]
      ]), JSON.stringify(window.webContents.sent));
      Assert.areEqual(JSON.stringify({ kind: "Ready", details: [] }), JSON.stringify(electron.ipcMain.invoke("teamrun:readStartup", DesktopStartFixture.trustedEvent("linux"))));
      Assert.isNull(electron.ipcMain.invoke("teamrun:readStartup", { sender: { id: 1 }, senderFrame: null }));
    });
  }

  @TestMethod
  public carriesOutThePersonsStartupChoiceFromItsWindowOnly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")));
    return DesktopStartFixture.startReadyAsync("linux", launcher).then(async electron => {
      const window = DesktopStartFixture.firstWindow(electron);

      Assert.isFalse(electron.ipcMain.invoke("teamrun:startupAction", { sender: { id: 1 }, senderFrame: null }, "moveAside") as boolean);
      window.isGone = true;
      Assert.isTrue(await (electron.ipcMain.invoke("teamrun:startupAction", DesktopStartFixture.trustedEvent("linux"), "moveAside") as Promise<boolean>));

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
    DesktopStartFixture.start(electron, process, new FakeRuntimeLauncher(handover));
    return DesktopStartFixture.openAsync(electron).then(async () => {
      await setImmediate();

      Assert.areEqual(
        JSON.stringify([["/opt/teamrun/teamrun", "--data-dir=/work/data", "--user-data-dir=/work/profile", "--device-dir=/work/device"]]),
        JSON.stringify(process.started));
      Assert.areEqual("quit", electron.app.calls.at(-1));
    });
  }

  @TestMethod
  public async logsAHandOverWhoseNewerBuildCannotStartAndQuits(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/teamrun/teamrun"));
    const process = new FakeDesktopProcess("linux", ["/opt/teamrun/teamrun-1", "--data-dir=/work/data"]);
    process.startFailure = new Error("spawn /opt/teamrun/teamrun ENOENT");
    const electron = new FakeElectron(true, true);
    DesktopStartFixture.start(electron, process, new FakeRuntimeLauncher(handover));
    await DesktopStartFixture.openAsync(electron);
    await Condition.waitAsync(() => electron.app.calls.includes("quit"));

    Assert.areEqual(JSON.stringify(["The newer TeamRun could not be started for the hand-over, so this one quits without it: Error: spawn /opt/teamrun/teamrun ENOENT"]),
      JSON.stringify(DesktopStartFixture.readErrors(process, "The newer TeamRun")));
  }

  @TestMethod
  public saysANewerBuildRunsWhenADevelopmentBuildCannotHandOver(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/electron/electron"));
    return DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(handover)).then(electron => {
      Assert.areEqual(JSON.stringify({ kind: "NewerBuild", details: ["2.0.0"] }), JSON.stringify(electron.ipcMain.invoke("teamrun:readStartup", DesktopStartFixture.trustedEvent("linux"))));
    });
  }

  @TestMethod
  public closesItsRuntimeConnectionWhenQuitting(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    return DesktopStartFixture.startReadyAsync("linux", launcher).then(electron => {
      electron.app.emit("will-quit");

      Assert.isTrue(launcher.connections[0]?.isClosed === true);
    });
  }

  @TestMethod
  public async waitsBeforeReconnectingAfterAConnectionEndsSoonAgainAndStopsWaitingWhenQuitting(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);

    launcher.listener?.onDisconnected(null);
    await setImmediate();
    launcher.listener?.onDisconnected(null);
    await setImmediate();
    const waiting = electron.ipcMain.invoke("teamrun:readStartup", DesktopStartFixture.trustedEvent("linux"));
    electron.app.emit("will-quit");
    await setImmediate();

    Assert.areEqual(JSON.stringify({ kind: "Connecting", details: [] }), JSON.stringify(waiting));
    Assert.areEqual(2, launcher.calls.length);
  }

  @TestMethod
  public async restoresTheSavedBoundsBeforeShowingTheWindow(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async maximizesAWindowSavedMaximizedAsItShowsItSoItOpensFocused(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: true });
    const electron = await DesktopStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(connection));
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("darwin"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.calls.includes("show"));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize", "show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async restoresTheSavedBoundsTheNextTimeTheRuntimeIsReadyWhenTheConnectionEndsDuringTheRead(): Promise<void> {
    const first = new FakeRuntimeConnection();
    first.deferred.set("shell.readWindowBounds", () => {
      first.isClosed = true;
      return Promise.reject(new ConnectionException("The connection to the runtime is closed."));
    });
    const second = new FakeRuntimeConnection();
    second.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const reconnection = Promise.withResolvers<FakeRuntimeConnection>();
    const launcher = new FakeRuntimeLauncher(first, reconnection.promise);
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    launcher.listener?.onDisconnected(null);
    reconnection.resolve(second);
    await Condition.waitAsync(() => window.calls.some(t => t.startsWith("setBounds")));

    Assert.areEqual(JSON.stringify(["show", "setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
    Assert.areEqual(0, DesktopStartFixture.readErrors(process, "The window's saved bounds").length);
    Assert.areEqual(0, DesktopStartFixture.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  public async readsTheDeviceIdentityFromTheFolderItIsGivenOrTheOperatingSystemsOne(): Promise<void> {
    const given = new FakeDeviceIdentity();
    const located = new FakeDeviceIdentity();
    const environment = { LOCALAPPDATA: "C:\\Users\\person\\AppData\\Local" };

    const first = new FakeElectron();
    const second = new FakeElectron();

    DesktopStartFixture.start(first, new FakeDesktopProcess("win32", ["--device-dir=/devices/this"]), new FakeRuntimeLauncher(), given);
    DesktopStartFixture.start(second, new FakeDesktopProcess("win32", [], environment, "C:\\Users\\person"), new FakeRuntimeLauncher(), located);
    await first.app.becomeReadyAsync();
    await second.app.becomeReadyAsync();

    Assert.areEqual(JSON.stringify(["/devices/this"]), JSON.stringify(given.folders));
    Assert.areEqual(JSON.stringify([DeviceFolder.locate("win32", environment, "C:\\Users\\person")]), JSON.stringify(located.folders));
  }

  @TestMethod
  public async keepsItsWindowsLayoutForThisDeviceThroughTheRuntime(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");

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
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const untrusted = { sender: { id: 1 }, senderFrame: null };
    const trusted = DesktopStartFixture.trustedEvent("linux");

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
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), device, process);
    const event = DesktopStartFixture.trustedEvent("linux");

    const read = await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", event);
    const write = await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 });

    const failure = { code: "Unavailable", message: "This device has no identity, so the window's layout and Do not disturb are not kept." };
    Assert.areEqual(JSON.stringify([failure, failure]), JSON.stringify([read["failure"], write["failure"]]));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "This device's identity").length);
  }

  @TestMethod
  public async answersALayoutTheRuntimeCannotKeepAsAFailureAndPassesOnDefects(): Promise<void> {
    const refused = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old"))));
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.length > 0);

    const unconnected = await DesktopApplicationTests.invokeAsync(refused, "teamrun:writeLayout", event, { version: 1 });
    connection.isFailing = true;
    const busy = await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", event);
    connection.rejection = new ConnectionException("The runtime did not answer shell.writeWindowLayout in time.");
    const late = await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 });
    connection.isClosed = true;
    connection.rejection = new ConnectionException("The connection to the runtime closed.");
    const closed = await DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 });
    connection.rejection = new TypeError("A defect.");

    await Assert.throwsAsync(() => DesktopApplicationTests.invokeAsync(electron, "teamrun:writeLayout", event, { version: 1 }), TypeError);
    Assert.areEqual(
      JSON.stringify([
        { code: "Disconnected", message: "TeamRun is not connected to its runtime." },
        { code: "Internal", message: "The database is busy." },
        { code: "Unavailable", message: "The runtime did not answer shell.writeWindowLayout in time." },
        { code: "Disconnected", message: "The connection to the runtime closed." }
      ]),
      JSON.stringify([unconnected["failure"], busy["failure"], late["failure"], closed["failure"]]));
  }

  @TestMethod
  public async passesItsWindowsRequestsToTheRuntimeAndAnswersAsItDoes(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("notes.open", Response.success("r", { title: "Notes" }));
    connection.answers.set("shell.modules", Response.success("r", { modules: [] }));
    connection.answers.set("shell.commands", Response.success("r", { commands: [] }));
    connection.answers.set("shell.runCommand", Response.success("r", 3));
    connection.answers.set("shell.programs", Response.success("r", { programs: [], sequence: 2 }));
    for (const name of DesktopApplicationTests.NOTIFICATION_METHODS)
      connection.answers.set(name, Response.success("r", name));
    connection.answers.set("notes.missing", Response.failure("r", new Failure(FailureCode.NotFound, "There is no such note.")));
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");

    const opened = await DesktopApplicationTests.requestAsync(electron, event, "notes.open", { path: "/notes/a.md" });
    const modules = await DesktopApplicationTests.requestAsync(electron, event, "shell.modules", null);
    const commands = await DesktopApplicationTests.requestAsync(electron, event, "shell.commands", null);
    const ran = await DesktopApplicationTests.requestAsync(electron, event, "shell.runCommand", { name: "clock.tick", arguments: null });
    const programs = await DesktopApplicationTests.requestAsync(electron, event, "shell.programs", null);
    const notifications = [];
    for (const name of DesktopApplicationTests.NOTIFICATION_METHODS)
      notifications.push((await DesktopApplicationTests.requestAsync(electron, event, name, null)).payload);
    const missing = await DesktopApplicationTests.requestAsync(electron, event, "notes.missing", null);

    Assert.areEqual(JSON.stringify({ title: "Notes" }), JSON.stringify(opened.payload));
    Assert.areEqual(JSON.stringify({ modules: [] }), JSON.stringify(modules.payload));
    Assert.areEqual(JSON.stringify({ commands: [] }), JSON.stringify(commands.payload));
    Assert.areEqual("3", JSON.stringify(ran.payload));
    Assert.areEqual(JSON.stringify({ programs: [], sequence: 2 }), JSON.stringify(programs.payload));
    Assert.areEqual(DesktopApplicationTests.NOTIFICATION_METHODS.join(","), notifications.join(","));
    Assert.areEqual(JSON.stringify({ code: "NotFound", message: "There is no such note." }), JSON.stringify(missing.failure?.toJson()));
  }

  @TestMethod
  public async addsThisDeviceToItsWindowsSettingsRequests(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    for (const name of ["shell.settings", "shell.readSetting", "shell.setSetting", "shell.resetSetting"])
      connection.answers.set(name, Response.success("r", name));
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.includes("shell.readSetting"));
    const start = connection.calls.length;

    const answers = [
      await DesktopApplicationTests.requestAsync(electron, event, "shell.settings", {}),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.readSetting", { name: "notes.wrapLines", scope: { name: "notes.project", id: "p1" } }),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.setSetting", { name: "shell.panelSize", value: 15 }),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.resetSetting", { name: "shell.panelSize", device: "another" })
    ];
    const sent = connection.calls.flatMap((t, index) => index >= start && (t.includes("Setting") || t === "shell.settings") ? [connection.payloads[index]] : []);

    Assert.areEqual("shell.settings,shell.readSetting,shell.setSetting,shell.resetSetting", answers.map(t => t.payload).join(","));
    Assert.areEqual(JSON.stringify([
      { device: FakeDeviceIdentity.ID },
      { name: "notes.wrapLines", scope: { name: "notes.project", id: "p1" }, device: FakeDeviceIdentity.ID },
      { name: "shell.panelSize", value: 15, device: FakeDeviceIdentity.ID },
      { name: "shell.panelSize", device: FakeDeviceIdentity.ID }
    ]), JSON.stringify(sent));
  }

  @TestMethod
  public async refusesADeviceRequestWithoutAnObjectOrADevice(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const anonymous = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new FakeRuntimeConnection()), new FakeElectron(), device);
    const event = DesktopStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.includes("shell.readSetting"));
    const start = connection.calls.length;

    const failures = [
      await DesktopApplicationTests.requestAsync(electron, event, "shell.settings", null),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.setSetting", [1]),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.recentCommands", null),
      await DesktopApplicationTests.requestAsync(anonymous, event, "shell.settings", {}),
      await DesktopApplicationTests.requestAsync(anonymous, event, "shell.recordCommand", { id: "notes.newNote" })
    ].map(t => t.failure?.toJson());

    Assert.areEqual(JSON.stringify([
      { code: "InvalidMessage", message: "A request that belongs to this device must have a JSON object as its payload." },
      { code: "InvalidMessage", message: "A request that belongs to this device must have a JSON object as its payload." },
      { code: "InvalidMessage", message: "A request that belongs to this device must have a JSON object as its payload." },
      { code: "Unavailable", message: "This device has no identity, so a request that belongs to it cannot be made." },
      { code: "Unavailable", message: "This device has no identity, so a request that belongs to it cannot be made." }
    ]), JSON.stringify(failures));
    Assert.isFalse(connection.calls.slice(start).some(t => t.includes("etting") || t.includes("ommand")));
  }

  @TestMethod
  public async refusesRequestsItsWindowMayNotMake(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const trusted = DesktopStartFixture.trustedEvent("linux");
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
    Assert.areEqual(JSON.stringify(["shell.readWindowBounds"]), JSON.stringify(connection.calls.filter(t => !["shell.work", "shell.notifications", "shell.readSetting"].includes(t))));
  }

  @TestMethod
  public async answersDisconnectedWithoutARuntimeOrAfterItsConnectionEndsAndPassesOnDefects(): Promise<void> {
    const refused = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old"))));
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");
    await Condition.waitAsync(() => connection.calls.length > 0);

    const unconnected = await DesktopApplicationTests.requestAsync(refused, event, "notes.open", null);
    connection.rejection = new ConnectionException("The runtime did not answer notes.open in time.");
    const late = await DesktopApplicationTests.requestAsync(electron, event, "notes.open", null);
    connection.isClosed = true;
    connection.rejection = new ConnectionException("The connection to the runtime closed.");
    const closed = await DesktopApplicationTests.requestAsync(electron, event, "notes.open", null);
    connection.rejection = new TypeError("A defect.");

    await Assert.throwsAsync(() => DesktopApplicationTests.requestAsync(electron, event, "notes.open", null), TypeError);
    Assert.areEqual(JSON.stringify({ code: "Disconnected", message: "TeamRun is not connected to its runtime." }), JSON.stringify(unconnected.failure?.toJson()));
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "The runtime did not answer notes.open in time." }), JSON.stringify(late.failure?.toJson()));
    Assert.areEqual(JSON.stringify({ code: "Disconnected", message: "The connection to the runtime closed." }), JSON.stringify(closed.failure?.toJson()));
  }

  @TestMethod
  public async addsItsOwnDeviceToItsWindowsNotificationReadsAndRefusesTheirDoNotDisturbSwitch(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.notifications", Response.success("r", { notifications: [], isDoNotDisturb: true, mutedModules: ["notes"], sequence: 2 }));
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lost = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new FakeRuntimeConnection()), new FakeElectron(), unidentified);
    await Condition.waitAsync(() => connection.calls.includes("shell.readSetting"));
    const start = connection.calls.length;

    const state = await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    const quiet = await DesktopApplicationTests.requestAsync(electron, event, "shell.setDoNotDisturb", { isOn: true });
    const noDevice = await DesktopApplicationTests.requestAsync(lost, event, "shell.notifications", {});

    const sent = connection.calls.map((t, index) => `${t} ${JSON.stringify(connection.payloads[index])}`).slice(start).filter(t => t.startsWith("shell.notifications") || t.startsWith("shell.setDoNotDisturb"));
    Assert.areEqual(JSON.stringify([`shell.notifications {"device":"${FakeDeviceIdentity.ID}"}`]), JSON.stringify(sent));
    Assert.areEqual("{\"notifications\":[],\"isDoNotDisturb\":true,\"mutedModules\":[\"notes\"],\"sequence\":2}", JSON.stringify(state.payload));
    Assert.areEqual(FailureCode.Unauthorized, quiet.failure?.code);
    Assert.areEqual(FailureCode.Unavailable, noDevice.failure?.code);
  }

  @TestMethod
  public async givesItsWindowsTheNotificationStateForTheirOwnDeviceOnly(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", DesktopStartFixture.trustedEvent("linux"));
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lostLauncher = new FakeRuntimeLauncher();
    const lost = await DesktopStartFixture.startReadyAsync("linux", lostLauncher, new FakeElectron(), unidentified);
    await DesktopApplicationTests.invokeAsync(lost, "teamrun:readLayout", DesktopStartFixture.trustedEvent("linux"));
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
      JSON.stringify(DesktopStartFixture.firstWindow(lost).webContents.sent.filter(t => t[0] === "teamrun:runtimeEvent")));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The runtime's event shell.notifications could not be passed to the window").length);
  }

  @TestMethod
  public async showsTheOperatingSystemANotificationPostedAfterItsWindowsReadWhileNoWindowIsFocusedAndOpensItInTheWindow(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const early = DesktopApplicationTests.wireNotification(1, "Early");
    connection.answers.set("shell.notifications", Response.success("r", { notifications: [early], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);
    const later = DesktopApplicationTests.wireNotification(2, "Later");
    await DesktopStartFixture.showAsync(electron, "linux", window);

    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [early], quietDevices: [], mutedModules: [], sequence: 1 }));
    await DesktopApplicationTests.requestAsync(electron, DesktopStartFixture.trustedEvent("linux"), "shell.notifications", {});
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [later, early], quietDevices: [], mutedModules: [], sequence: 2 }));
    window.isFocusedNow = true;
    launcher.listener?.onEvent(new Event(ShellEvents.notifications, { notifications: [DesktopApplicationTests.wireNotification(3, "Focused"), later, early], quietDevices: [], mutedModules: [], sequence: 3 }));
    window.isMinimizedNow = true;
    electron.notifications.created[0]?.click();

    Assert.areEqual("Later", electron.notifications.created.map(t => t.title).join(","));
    Assert.isTrue(String(electron.notifications.created[0]?.options.icon).endsWith("icon-dark-512.png"));
    Assert.areEqual("restore,focus", window.calls.filter(t => t === "restore" || t === "focus").join(","));
    Assert.areEqual(JSON.stringify([["teamrun:notificationOpened", "2"]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:notificationOpened")));
  }

  @TestMethod
  public async holdsTheOperatingSystemsNotificationsWhileItsWindowReloadsUntilTheWindowReadsAgain(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const alarm = DesktopApplicationTests.wireNotification(1, "Alarm");
    connection.answers.set("shell.notifications", Response.success("r", { notifications: [alarm], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);
    const event = DesktopStartFixture.trustedEvent("linux");
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
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const unidentified = new FakeDeviceIdentity();
    unidentified.failure = new Error("The identity file is not JSON.");
    const lostLauncher = new FakeRuntimeLauncher(new FakeRuntimeConnection());
    const lost = await DesktopStartFixture.startReadyAsync("linux", lostLauncher, new FakeElectron(), unidentified);
    const event = DesktopStartFixture.trustedEvent("linux");
    const posted = new Event(ShellEvents.notifications, { notifications: [DesktopApplicationTests.wireNotification(1, "Alarm")], quietDevices: [], mutedModules: [], sequence: 1 });

    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    await DesktopApplicationTests.requestAsync(lost, event, "shell.notifications", {});
    launcher.listener?.onEvent(posted);
    lostLauncher.listener?.onEvent(posted);
    first.answers.set("shell.notifications", Response.success("r", { notifications: [] }));
    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    first.answers.set("shell.notifications", Response.success("r", { notifications: [], isDoNotDisturb: false, mutedModules: [], sequence: 1 }));
    await DesktopApplicationTests.requestAsync(electron, event, "shell.notifications", {});
    launcher.listener?.onDisconnected(null);
    reconnect(second);
    await Condition.waitAsync(() => launcher.connections.length === 2);
    await setImmediate();
    launcher.listener?.onEvent(posted);

    Assert.areEqual("0,0", [electron.notifications.created.length, lost.notifications.created.length].join(","));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The notifications could not be read, so the operating system shows none until the window reads them again: ").length);
  }

  @TestMethod
  public async passesTheRuntimesEventsToItsWindowsThatRemain(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);

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
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
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
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The runtime's event shell.settingsChanged could not be passed to the window").length);
  }

  @TestMethod
  public async addsItsOwnDeviceToItsWindowsRecentCommandsRequests(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.recentCommands", Response.success("r", { ids: ["notes.newNote"] }));
    connection.answers.set("shell.recordCommand", Response.success("r", null));
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");

    const recent = await DesktopApplicationTests.requestAsync(electron, event, "shell.recentCommands", {});
    const recorded = await DesktopApplicationTests.requestAsync(electron, event, "shell.recordCommand", { id: "notes.newNote" });

    const sent = connection.calls.map((t, index) => `${t} ${JSON.stringify(connection.payloads[index])}`).filter(t => t.startsWith("shell.recentCommands") || t.startsWith("shell.recordCommand"));
    Assert.areEqual(JSON.stringify([
      `shell.recentCommands ${JSON.stringify({ device: FakeDeviceIdentity.ID })}`,
      `shell.recordCommand ${JSON.stringify({ id: "notes.newNote", device: FakeDeviceIdentity.ID })}`
    ]), JSON.stringify(sent));
    Assert.areEqual(JSON.stringify({ ids: ["notes.newNote"] }), JSON.stringify(recent.payload));
    Assert.isFalse(recorded.hasFailed);
  }

  @TestMethod
  public async passesRecentCommandsOnlyToTheDeviceThatRanThemWithoutItsDevice(): Promise<void> {
    const launcher = new FakeRuntimeLauncher();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    await DesktopApplicationTests.invokeAsync(electron, "teamrun:readLayout", DesktopStartFixture.trustedEvent("linux"));

    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, new RecentCommands(["notes.newNote"], FakeDeviceIdentity.ID).toJson()));
    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, new RecentCommands(["clock.show"], "another").toJson()));
    launcher.listener?.onEvent(new Event(ShellEvents.recentCommandsChanged, { device: FakeDeviceIdentity.ID }));

    Assert.areEqual(
      JSON.stringify([["teamrun:runtimeEvent", "shell.recentCommandsChanged", { ids: ["notes.newNote"] }]]),
      JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:runtimeEvent")));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The runtime's event shell.recentCommandsChanged could not be passed to the window").length);
  }

  @TestMethod
  public async showsAWindowWhoseRuntimeIsSlowToStartAndRestoresItsBoundsOnceReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })));
    const window = DesktopStartFixture.firstWindow(electron);
    const started = Date.now();

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
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
  public async keepsAndSavesWhereThePersonPlacedAWindowShownBeforeTheRuntimeWasReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const electron = await DesktopStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })));
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("win32"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("will-move");
    arrive(connection);
    await Condition.waitAsync(() => connection.calls.includes("shell.writeWindowBounds"));

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(
      JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async writesWhereThePersonPlacedAWindowToTheNextConnectionWhenTheFirstClosesDuringTheRestore(): Promise<void> {
    const first = new FakeRuntimeConnection();
    first.deferred.set("shell.writeWindowBounds", () => {
      first.isClosed = true;
      return Promise.reject(new ConnectionException("The connection to the runtime is closed."));
    });
    const second = new FakeRuntimeConnection();
    second.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const connections = [Promise.withResolvers<FakeRuntimeConnection>(), Promise.withResolvers<FakeRuntimeConnection>()];
    const launcher = new FakeRuntimeLauncher(...connections.map(t => t.promise));
    const process = new FakeDesktopProcess("win32");
    const electron = await DesktopStartFixture.startReadyAsync("win32", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("win32"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("will-move");
    connections[0]?.resolve(first);
    await Condition.waitAsync(() => first.calls.includes("shell.writeWindowBounds"));
    await setImmediate();
    launcher.listener?.onDisconnected(null);
    connections[1]?.resolve(second);
    await Condition.waitAsync(() => second.calls.includes("shell.writeWindowBounds"));

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.isFalse(second.calls.includes("shell.readWindowBounds"));
    Assert.areEqual(
      JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }),
      JSON.stringify(second.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    Assert.areEqual(0, DesktopStartFixture.readErrors(process, "The window's saved bounds").length);
    Assert.areEqual(0, DesktopStartFixture.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  public async restoresTheSavedBoundsOfAWindowMovedBeforeTheRuntimeWasReadyWhereTheSystemAlsoMovesIt(platform: string): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: false });
    let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
    const electron = await DesktopStartFixture.startReadyAsync(platform, new FakeRuntimeLauncher(new Promise(resolve => {
      arrive = resolve;
    })));
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent(platform), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    window.change("will-move");
    arrive(connection);
    await Condition.waitAsync(() => window.calls.some(t => t.startsWith("setBounds")));

    Assert.areEqual(0, connection.calls.filter(t => t === "shell.writeWindowBounds").length);
  }

  @TestMethod
  public async recordsBoundsLostWhenAWindowMovedBeforeTheRuntimeWasReadyClosesFirst(): Promise<void> {
    const process = new FakeDesktopProcess("win32");
    const electron = await DesktopStartFixture.startReadyAsync("win32", new FakeRuntimeLauncher(new Promise<FakeRuntimeConnection>(() => undefined)), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("win32"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("will-move");

    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The window closed without saving its bounds, because the runtime could not be reached").length);
  }

  @TestMethod
  public async savesTheBoundsBeforeTheWindowCloses(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    window.bounds = { x: 300, y: 150, width: 1100, height: 750 };

    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(
      JSON.stringify({ x: 300, y: 150, width: 1100, height: 750, maximized: false }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async stopsClosingAWindowThatIsGoneWhileItsBoundsAreSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    connection.onCall = () => {
      if (connection.calls.at(-1) === "shell.writeWindowBounds")
        window.destroy();
    };

    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);
    await setImmediate();

    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async closesEvenWhenTheBoundsCannotBeSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    await Condition.waitAsync(() => connection.calls.length > 0);
    connection.isFailing = true;

    window.close();
    await DesktopStartFixture.answerSaveAsync(electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The window's bounds could not be saved: WindowStateException: The runtime refused shell.writeWindowBounds").length);
  }

  @TestMethod
  public async showsTheWindowWithItsDefaultBoundsWhenTheSavedOnesCannotBeUsed(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { width: 10 });
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The window's saved bounds could not be restored, so it opens with its default bounds:").length);
  }

  @TestMethod
  public async showsTheWindowWithoutKeepingBoundsWhenTheDeviceHasNoIdentity(): Promise<void> {
    const device = new FakeDeviceIdentity();
    device.failure = new Error("The identity file is not JSON.");
    const connection = new FakeRuntimeConnection();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), device, process);
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);

    Assert.areEqual(0, connection.calls.length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "This device's identity could not be read, so window bounds are not kept:").length);
  }

  @TestMethod
  public async showsARefusalAtOnceAndRestoresTheBoundsOnceTheRuntimeIsReady(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.states.set(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`, { x: 200, y: 100, width: 1000, height: 700, maximized: true });
    const launcher = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old")), connection);
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);

    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    await (electron.ipcMain.invoke("teamrun:startupAction", DesktopStartFixture.trustedEvent("linux"), "moveAside") as Promise<boolean>);
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
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("shell.readWindowBounds"));

    launcher.listener?.onDisconnected(null);
    const readsBeforeTheMove = window.boundsReads;
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    const writesWhileGone = [...first.calls, ...second.calls].filter(t => t === "shell.writeWindowBounds").length;
    reconnect(second);
    await Condition.waitAsync(() => second.calls.includes("shell.writeWindowBounds"));

    Assert.areEqual(0, writesWhileGone);
    Assert.areEqual(JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }), JSON.stringify(second.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    Assert.areEqual(0, DesktopStartFixture.readErrors(process, "The window's bounds").length);
  }

  @TestMethod
  public async keepsBoundsWhoseConnectionClosesAsItBecomesReadyForTheNextConnection(): Promise<void> {
    const first = new FakeRuntimeConnection();
    const second = new FakeRuntimeConnection();
    const third = new FakeRuntimeConnection();
    second.deferred.set("shell.writeWindowBounds", () => {
      second.isClosed = true;
      return Promise.reject(new ConnectionException("The connection to the runtime is closed."));
    });
    const reconnections = [Promise.withResolvers<FakeRuntimeConnection>(), Promise.withResolvers<FakeRuntimeConnection>()];
    const launcher = new FakeRuntimeLauncher(first, ...reconnections.map(t => t.promise));
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("shell.readWindowBounds"));

    launcher.listener?.onDisconnected(null);
    const readsBeforeTheMove = window.boundsReads;
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    reconnections[0]?.resolve(second);
    await Condition.waitAsync(() => second.calls.includes("shell.writeWindowBounds"));
    await setImmediate();
    launcher.listener?.onDisconnected(null);
    reconnections[1]?.resolve(third);
    await Condition.waitAsync(() => third.calls.includes("shell.writeWindowBounds"));

    Assert.areEqual(JSON.stringify({ x: 40, y: 60, width: 900, height: 640, maximized: false }), JSON.stringify(third.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
    Assert.areEqual(0, DesktopStartFixture.readErrors(process, "The window's bounds").length);
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
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher, new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), DesktopStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown && first.calls.includes("shell.readWindowBounds"));

    launcher.listener?.onDisconnected(null);
    const readsBeforeTheMove = window.boundsReads;
    window.change("move");
    await Condition.waitAsync(() => window.boundsReads > readsBeforeTheMove);
    reconnect(second);
    await Condition.waitAsync(() => DesktopStartFixture.readErrors(process, "The window's bounds").length > 0);

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: WindowStateException: The runtime refused shell.writeWindowBounds: The database is busy."]),
      JSON.stringify(DesktopStartFixture.readErrors(process, "The window's bounds")));
  }

  @TestMethod
  public async tellsOnlyItsOwnWindowWhichBuildItIs(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");

    const build = electron.ipcMain.invoke("teamrun:readBuild", DesktopStartFixture.trustedEvent("linux"));
    const refused = electron.ipcMain.invoke("teamrun:readBuild", { sender: { id: 1 }, senderFrame: null });

    Assert.areEqual(JSON.stringify(RuntimeBuild.identity.toJson()), JSON.stringify(build));
    Assert.isNull(refused);
  }

  @TestMethod
  public async tellsOnlyItsOwnWindowThatUpdatesAreOffAndActsOnNoUpdate(): Promise<void> {
    const fixture = new TrayFixture("linux");
    await fixture.startAsync();

    fixture.send("settingsChanged", { name: "shell.updateChecks", device: FakeDeviceIdentity.ID, value: "OnRequest", isSet: true });
    const state = fixture.electron.ipcMain.invoke("teamrun:readUpdate", DesktopStartFixture.trustedEvent("linux"));
    const refused = fixture.electron.ipcMain.invoke("teamrun:readUpdate", { sender: { id: 1 }, senderFrame: null });
    const acted = fixture.electron.ipcMain.invoke("teamrun:updateAction", DesktopStartFixture.trustedEvent("linux"), "Check");

    Assert.areEqual(JSON.stringify({ kind: "Off", version: null, progress: null, checkedAt: null, reason: null, mustMove: false }), JSON.stringify(state));
    Assert.isNull(refused);
    Assert.isFalse(acted as boolean);
    Assert.areEqual(0, fixture.files.created.filter(t => t[1] === "update-ready.json").length);
  }

  @TestMethod
  public async checksOnlyForItsOwnWindowAndPushesEachStateToItsWindows(): Promise<void> {
    const updater = new FakeUpdater();
    const files = new FakeDeviceFiles();
    const process = new FakeDesktopProcess("linux");
    const connection = new FakeRuntimeConnection();
    const lock = new FakeUpdateCheckLock();
    const electron = await DesktopApplicationTests.startWithUpdaterAsync(process, updater, files, connection, new FakeElectron(), new FakeDeviceIdentity(), lock);
    await Condition.waitAsync(() => connection.payloads.some(t => JSON.stringify(t).includes("shell.updateChecks")) && files.updateReady.reads === 1);
    const window = DesktopStartFixture.firstWindow(electron);
    const trusted = DesktopStartFixture.trustedEvent("linux");

    const refused = electron.ipcMain.invoke("teamrun:updateAction", { sender: { id: 1 }, senderFrame: null }, "Check");
    const acted = electron.ipcMain.invoke("teamrun:updateAction", trusted, "Check");
    await Condition.waitAsync(() => DesktopApplicationTests.updateStates(window).length >= 2);
    const state = electron.ipcMain.invoke("teamrun:readUpdate", trusted);
    window.isGone = true;
    electron.ipcMain.invoke("teamrun:updateAction", trusted, "Check");
    await Condition.waitAsync(() => lock.releases === 2);

    Assert.isFalse(refused as boolean);
    Assert.isTrue(acted as boolean);
    Assert.areEqual(JSON.stringify(["Checking", "UpToDate"]), JSON.stringify(DesktopApplicationTests.updateStates(window)));
    Assert.areEqual("UpToDate", Reflect.get(Object(state), "kind"));
    Assert.areEqual(1, files.created.filter(t => t[1] === "update-ready.json").length);
    Assert.areEqual(3, files.updateReady.reads);
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The updater reported: started").length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The update lock reported: started").length);
  }

  @TestMethod
  public async clearsWhatAnEarlierHandoffLeftOnceItStartsItsUpdates(): Promise<void> {
    const electron = new FakeElectron();
    const handoff = new FakeUpdateHandoff();
    DesktopStartFixture.start(electron, new FakeDesktopProcess("linux"), new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), new FakePathCommand(), [],
      () => Promise.resolve(true), () => new FakeUpdater(), undefined, handoff);
    const before = handoff.clears;

    await DesktopStartFixture.openAsync(electron);
    await Condition.waitAsync(() => handoff.clears > 0);

    Assert.areEqual(0, before);
    Assert.areEqual(1, handoff.clears);
  }

  @TestMethod
  @TestData("win32")
  @TestData("linux")
  public async quitsAtOnceWithoutAskingAgainOnceTheHandoffSucceeds(platform: string): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await DesktopApplicationTests.restartToUpdateAsync(platform, handoff, async electron => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify(["999.0.0"]), JSON.stringify(handoff.handedOff));
      Assert.isFalse(electron.app.calls.includes("quit prevented"));
      Assert.areEqual(0, electron.nativeUpdater.installs);
    });
  }

  @TestMethod
  @TestData("win32")
  @TestData("darwin")
  public async keepsItsFoldersForTheNewVersionThatWindowsOrMacOSStartsWithoutArguments(platform: string): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const kept: unknown[] = [];
    const before = Date.now();
    await DesktopApplicationTests.restartToUpdateAsync(platform, handoff, async (electron, desktop) => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0") || electron.nativeUpdater.installs > 0);

      Assert.areEqual(JSON.stringify([{ version: "999.0.0", arguments: [`--device-dir=${desktop.temporaryFolder}`] }]),
        JSON.stringify(kept.map(t => ({ version: Reflect.get(Object(t), "version"), arguments: Reflect.get(Object(t), "arguments") }))));
      const written = Number(Reflect.get(Object(kept[0]), "written"));
      Assert.isTrue(written >= before && written <= Date.now(), String(written));
    }, null, true, process.pid, desktop => {
      handoff.handOff = async () => {
        kept.push(await DesktopApplicationTests.readKeptAsync(desktop));
        return 5230;
      };
      return Promise.resolve();
    });
  }

  @TestMethod
  public async keepsNoFoldersOnLinuxWhereTheRestartPassesThemOn(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const kept: unknown[] = [];
    await DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async electron => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify([null]), JSON.stringify(kept));
    }, null, true, process.pid, desktop => {
      handoff.handOff = async () => {
        kept.push(await DesktopApplicationTests.readKeptAsync(desktop));
        return null;
      };
      return Promise.resolve();
    });
  }

  @TestMethod
  public async failsTheUpdateWithoutHandingItOffWhenItCannotKeepItsFolders(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await DesktopApplicationTests.restartToUpdateAsync("win32", handoff, async electron => {
      const trusted = DesktopStartFixture.trustedEvent("win32");
      await Condition.waitAsync(() => Object.isString(Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "reason")));

      Assert.areEqual("TeamRun couldn't keep its data and device folders for the new version, so the update wasn't installed.",
        Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "reason"));
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, null, true, process.pid, desktop => mkdir(join(DesktopApplicationTests.keptFile(desktop), "held"), { recursive: true }));
  }

  @TestMethod
  public async logsTheKeptFoldersItCouldNotRemoveAfterAHandoffThatFailed(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await DesktopApplicationTests.restartToUpdateAsync("win32", handoff, async (_electron, desktop) => {
      await Condition.waitAsync(() => DesktopStartFixture.readErrors(desktop, "The update failed: ").length === 1);

      Assert.areEqual(1, DesktopStartFixture.readErrors(desktop, "The folders kept for the new version could not be removed after the update failed: ").length);
      Assert.areEqual(JSON.stringify(["The update failed: The installer could not be started."]), JSON.stringify(DesktopStartFixture.readErrors(desktop, "The update failed: ")));
    }, null, true, process.pid, desktop => {
      handoff.handOff = async () => {
        const file = DesktopApplicationTests.keptFile(desktop);
        await rm(file);
        await mkdir(join(file, "held"), { recursive: true });
        throw new UpdateHandoffException("The installer could not be started.");
      };
      return Promise.resolve();
    });
  }

  @TestMethod
  public async stopsItsTrayHostMonitorAndTrayBeforeItExitsAfterTheHandoff(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    await DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async (electron, desktop) => {
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(1, desktop.programs.starts.length);
      Assert.areEqual(1, desktop.programs.stops);
      Assert.isUndefined(electron.tray.shown);
    });
  }

  @TestMethod
  public async quitsThroughSquirrelOnMacOSWithoutAskingAgainOnceTheHandoffSucceeds(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.resolve(5230);
    await DesktopApplicationTests.restartToUpdateAsync("darwin", handoff, async electron => {
      await Condition.waitAsync(() => electron.nativeUpdater.installs > 0);

      Assert.areEqual(1, electron.nativeUpdater.installs);
      Assert.isTrue(DesktopStartFixture.firstWindow(electron).isGone);
      Assert.isTrue(electron.app.calls.includes("quit"));
      Assert.isFalse(electron.app.calls.includes("quit prevented"));
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    });
  }

  @TestMethod
  @TestData("win32")
  @TestData("linux")
  @TestData("darwin")
  public async stillAsksBeforeQuittingAfterAHandoffThatFailed(platform: string): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.reject(new UpdateHandoffException("The installer could not be started."));
    await DesktopApplicationTests.restartToUpdateAsync(platform, handoff, async (electron, desktop) => {
      const trusted = DesktopStartFixture.trustedEvent(platform);
      await Condition.waitAsync(() => Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "reason") === "The installer could not be started.");

      const window = DesktopStartFixture.firstWindow(electron);
      electron.app.quit();
      await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 1);
      electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent(platform), DesktopStartFixture.closeRequests(window)[0], false);

      Assert.isTrue(electron.app.calls.includes("quit prevented"));
      Assert.isFalse(electron.app.calls.includes("exit 0"));
      Assert.areEqual(0, electron.nativeUpdater.installs);
      Assert.isFalse(existsSync(DesktopApplicationTests.keptFile(desktop)));
    });
  }

  @TestMethod
  public async getsItsRuntimeBackByItselfOnceAHandoffFailedAfterTheRuntimeStopped(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.reject(new UpdateHandoffException("The installer could not be started."));
    const target = new FakeRuntimeConnection();
    target.answers.set("shell.update", Response.success("r", new UpdateReady([], []).toJson()));
    const runtime = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });
    try {
      Assert.isDefined(runtime.pid);
      await DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async (electron, desktop, _installation, launcher) => {
        const [own] = launcher.listeners;
        target.onCall = () => {
          if (target.calls.at(-1) === "shell.update")
            own?.onEvent(new Event(ShellEvents.updating, null));
          else if (target.calls.at(-1) === "shell.stop") {
            runtime.kill();
            own?.onDisconnected(null);
          }
        };
        const window = DesktopStartFixture.firstWindow(electron);
        const trusted = DesktopStartFixture.trustedEvent("linux");
        await Condition.waitAsync(() => window.webContents.sent.some(t => t[0] === "teamrun:updateSaveRequest"));
        electron.ipcMain.invoke("teamrun:updateSaveAnswer", trusted, window.webContents.sent.find(t => t[0] === "teamrun:updateSaveRequest")?.[1], []);
        await Condition.waitAsync(() => launcher.calls.filter(t => t === "attach desktop IfIdle").length === 2);
        await Condition.waitAsync(() => JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:startupState").at(-1)?.[1]) === JSON.stringify({ kind: "Ready", details: [] }));

        Assert.isTrue(window.webContents.sent.some(t => t[0] === "teamrun:startupState" && Reflect.get(Object(t[1]), "kind") === "Updating"));
        Assert.areEqual("The installer could not be started.", Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "reason"));
        Assert.areEqual(JSON.stringify(["The update failed: The installer could not be started."]), JSON.stringify(DesktopStartFixture.readErrors(desktop, "The update failed")));
        Assert.isFalse(electron.app.calls.includes("exit 0"));
      }, target, true, runtime.pid);
    }
    finally {
      runtime.kill();
    }
  }

  @TestMethod
  public async explainsAndQuitsWhenAskingMacOSToInstallTheUpdateThrows(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.resolve(5230);
    await DesktopApplicationTests.restartToUpdateAsync("darwin", handoff, async (electron, desktop) => {
      electron.nativeUpdater.onInstall = () => {
        throw new Error("No update available, can't quit and install");
      };
      electron.dialog.failure = new Error("The dialog could not be shown.");
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(1, electron.dialog.boxes.length);
      Assert.areEqual(1, DesktopStartFixture.readErrors(desktop,
        "The update was handed off, but macOS could not be asked to install it and start the new version, so the desktop quits instead: Error: No update available").length);
    });
  }

  @TestMethod
  public async explainsAndQuitsWhenMacOSCannotBeAskedToInstallTheUpdate(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    handoff.handOff = () => Promise.resolve(5230);
    await DesktopApplicationTests.restartToUpdateAsync("darwin", handoff, async (electron, desktop) => {
      electron.nativeUpdater.onInstall = () => void Promise.resolve().then(() => electron.nativeUpdater.emit("error", new Error("No update available, can't quit and install")));
      electron.dialog.failure = new Error("The dialog could not be shown.");
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(JSON.stringify([{
        message: "macOS will install the update once TeamRun quits, but TeamRun can't open again by itself.",
        detail: "Open TeamRun once the update has installed."
      }]), JSON.stringify(electron.dialog.boxes.map(t => ({ message: t.options.message, detail: t.options.detail }))));
      Assert.areEqual(1, DesktopStartFixture.readErrors(desktop,
        "The update was handed off, but macOS could not be asked to install it and start the new version, so the desktop quits instead: Error: No update available").length);
      Assert.isFalse(electron.app.calls.includes("quit prevented"));
    });
  }

  @TestMethod
  public async asksAboutWorkInTheInstallationsDataDirectoriesBeforeAnUpdateAndChangesNothingWhenCancelled(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    await DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async electron => {
      const window = DesktopStartFixture.firstWindow(electron);
      await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);
      const answered = electron.ipcMain.invoke("teamrun:quitAnswer", DesktopStartFixture.trustedEvent("linux"), "Cancel");
      await Condition.waitAsync(() => target.isClosed);

      Assert.isTrue(answered as boolean);
      Assert.areEqual(true, Reflect.get(Object(DesktopApplicationTests.quitQuestions(window)[0]), "isUpdate"));
      Assert.isNull(DesktopApplicationTests.quitQuestions(window)[1]);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public holdsTheRuntimesQuitWhileItRestartsToUpdateAndAnswersItOnceTheUpdateIsCancelled(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    return DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async (electron, _desktop, _installation, launcher) => {
      const window = DesktopStartFixture.firstWindow(electron);
      const trusted = DesktopStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);

      launcher.listeners[0]?.onEvent(new Event(ShellEvents.quitting, null));
      await setImmediate();
      const held = DesktopStartFixture.closeRequests(window).length;
      electron.ipcMain.invoke("teamrun:quitAnswer", trusted, "Cancel");
      await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 1);
      electron.ipcMain.invoke("teamrun:closeAnswer", trusted, DesktopStartFixture.closeRequests(window)[0], false);
      await Condition.waitAsync(() => launcher.connections[0]?.calls.includes("shell.quitAnswered") === true);

      Assert.areEqual(0, held);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public holdsAQuitWhileItRestartsToUpdateAndQuitsAsUsualOnceTheUpdateIsCancelled(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    return DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async electron => {
      const window = DesktopStartFixture.firstWindow(electron);
      const trusted = DesktopStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);

      electron.app.quit();
      const held = DesktopStartFixture.closeRequests(window).length;
      electron.ipcMain.invoke("teamrun:quitAnswer", trusted, "Cancel");
      await Condition.waitAsync(() => DesktopStartFixture.closeRequests(window).length === 1);
      electron.ipcMain.invoke("teamrun:closeAnswer", trusted, DesktopStartFixture.closeRequests(window)[0], false);

      Assert.areEqual(0, held);
      Assert.isTrue(electron.app.calls.includes("quit prevented"));
      Assert.isTrue(target.isClosed);
      Assert.areEqual(0, handoff.handedOff.length);
    }, target);
  }

  @TestMethod
  public logsABarrierItCannotRemoveOnceARuntimeRefusesTheUpdate(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("shell.update", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is stopping.")));
    return DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async (electron, desktop, installation) => {
      using _rm = new FailingFileCallFixture("rm", installation.barrierFile, "EBUSY");

      await Condition.waitAsync(() => DesktopStartFixture.readErrors(desktop, "The update's barrier could not be removed").length === 1);

      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public refusesToRestartToAnUpdateItsHandoffCannotInstallWithoutStoppingAnything(): Promise<void> {
    return DesktopApplicationTests.withReadyFileAsync(async record => {
      const handoff = new FakeUpdateHandoff();
      handoff.refusal = "This copy can't install updates.";
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const electron = new FakeElectron();
      DesktopStartFixture.start(electron, new FakeDesktopProcess("linux"), new FakeRuntimeLauncher(), new FakeDeviceIdentity(), files, new FakePathCommand(), [],
        () => Promise.resolve(true), () => new FakeUpdater(String(record["file"])), undefined, handoff);
      await DesktopStartFixture.openAsync(electron);
      const trusted = DesktopStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "kind") === "Failed");

      const isStarted = electron.ipcMain.invoke("teamrun:updateAction", trusted, "Restart");

      Assert.isFalse(isStarted as boolean);
      Assert.areEqual("This copy can't install updates.", Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "reason"));
      Assert.areEqual(0, handoff.handedOff.length);
    });
  }

  @TestMethod
  public async stopsWaitingForWorkAndChangesNothingWhenCancelledWhileWaiting(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    await DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async electron => {
      const window = DesktopStartFixture.firstWindow(electron);
      const trusted = DesktopStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);
      const waited = electron.ipcMain.invoke("teamrun:quitAnswer", trusted, "Wait");
      const cancelled = electron.ipcMain.invoke("teamrun:quitAnswer", trusted, "Cancel");
      await Condition.waitAsync(() => target.isClosed);

      Assert.isTrue(waited as boolean);
      Assert.isTrue(cancelled as boolean);
      Assert.areEqual(1, target.calls.filter(t => t === "shell.work").length);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target);
  }

  @TestMethod
  public async changesNothingWhenItsWindowClosesBeforeItCanAskAboutWork(): Promise<void> {
    const handoff = new FakeUpdateHandoff();
    const target = new FakeRuntimeConnection();
    target.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    await DesktopApplicationTests.restartToUpdateAsync("linux", handoff, async electron => {
      const window = DesktopStartFixture.firstWindow(electron);
      await Condition.waitAsync(() => target.calls.includes("shell.work"));
      await setImmediate();
      window.destroy();
      await Condition.waitAsync(() => target.isClosed);

      Assert.areEqual(0, DesktopApplicationTests.quitQuestions(window).length);
      Assert.areEqual(0, handoff.handedOff.length);
      Assert.isFalse(electron.app.calls.includes("exit 0"));
    }, target, false);
  }

  @TestMethod
  public tellsItsUpdaterWhetherItRunsFromAPackagedBuild(): void {
    const told: boolean[] = [];
    const builds: readonly (readonly [boolean, boolean])[] = [[true, false], [false, false], [true, true]];
    for (const [isPackaged, isDefaultApp] of builds) {
      const process = new FakeDesktopProcess("linux");
      process.isDefaultApp = isDefaultApp;
      DesktopStartFixture.start(new FakeElectron(true, isPackaged), process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), new FakePathCommand(), [],
        () => Promise.resolve(true), (_, packaged) => {
          told.push(packaged);
          return null;
        });
    }

    Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify(told));
  }

  @TestMethod
  public async startsWithItsUpdatesFailedAndTheReasonLoggedWhenItsUpdaterCannotBeCreated(): Promise<void> {
    const electron = new FakeElectron();
    const process = new FakeDesktopProcess("linux");
    DesktopStartFixture.start(electron, process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), new FakePathCommand(), [], () => Promise.resolve(true), () => {
      throw new Error("ERR_UPDATER_INVALID_VERSION: App version is not a valid semver version: \"0.0\"");
    });
    await DesktopStartFixture.openAsync(electron);
    const trusted = DesktopStartFixture.trustedEvent("linux");

    const state = electron.ipcMain.invoke("teamrun:readUpdate", trusted);
    const acted = electron.ipcMain.invoke("teamrun:updateAction", trusted, "Check");

    Assert.areEqual(JSON.stringify({ kind: "Failed", version: null, progress: null, checkedAt: null, reason: "TeamRun couldn't start checking for updates.", mustMove: false }), JSON.stringify(state));
    Assert.isFalse(acted as boolean);
    Assert.areEqual(1, electron.windows.length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(process,
      "The updater could not be created, so this desktop doesn't check for updates: Error: ERR_UPDATER_INVALID_VERSION: App version is not a valid semver version: \"0.0\"").length);
  }

  @TestMethod
  public postsAReadyUpdateOnceOverItsRuntimeConnection(): Promise<void> {
    return DesktopApplicationTests.withReadyFileAsync(async record => {
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const connection = new FakeRuntimeConnection();
      connection.answers.set("shell.postNotification", Response.success("r", null));

      const electron = await DesktopApplicationTests.startWithUpdaterAsync(new FakeDesktopProcess("linux"), new FakeUpdater(String(record["file"])), files, connection);
      await Condition.waitAsync(() => files.updateReady.writes.length > 0 && connection.calls.includes("shell.readSetting"));

      Assert.areEqual(JSON.stringify([{
        kind: "shell.updateReady",
        key: "999.0.0",
        title: "TeamRun 999.0.0 is ready to install.",
        severity: "Info",
        actions: [{ title: "Restart to update", command: { name: "shell.restartToUpdate", arguments: null } }]
      }]), JSON.stringify(connection.payloads.filter((_, index) => connection.calls[index] === "shell.postNotification")));
      Assert.areEqual(JSON.stringify([{ ...record, notified: true }]), JSON.stringify(files.updateReady.writes));
      Assert.areEqual("Ready", Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", DesktopStartFixture.trustedEvent("linux"))), "kind"));
    });
  }

  @TestMethod
  public waitsForItsRuntimeBeforePostingAReadyUpdateFoundAtStart(): Promise<void> {
    return DesktopApplicationTests.withReadyFileAsync(async record => {
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const connection = new FakeRuntimeConnection();
      connection.answers.set("shell.postNotification", Response.success("r", null));
      let arrive: (connection: FakeRuntimeConnection) => void = () => undefined;
      const process = new FakeDesktopProcess("linux");

      const electron = await DesktopApplicationTests.startWithUpdaterAsync(process, new FakeUpdater(String(record["file"])), files, connection, new FakeElectron(), new FakeDeviceIdentity(),
        new FakeUpdateCheckLock(), new FakeRuntimeLauncher(new Promise(resolve => {
          arrive = resolve;
        })));
      await Condition.waitAsync(() => Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", DesktopStartFixture.trustedEvent("linux"))), "kind") === "Ready");
      const errorsBeforeReady = DesktopStartFixture.readErrors(process, "The runtime refused the ready update's notification").length;
      arrive(connection);
      await Condition.waitAsync(() => files.updateReady.writes.length > 0);

      Assert.areEqual(0, errorsBeforeReady);
      Assert.areEqual(1, connection.calls.filter(t => t === "shell.postNotification").length);
    });
  }

  @TestMethod
  public postsAReadyUpdateWithoutTheDevicesIdentityAndKeepsItUnpostedWhileTheRuntimeRefuses(): Promise<void> {
    return DesktopApplicationTests.withReadyFileAsync(async record => {
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const connection = new FakeRuntimeConnection();
      connection.answers.set("shell.postNotification", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
      const device = new FakeDeviceIdentity();
      device.failure = new Error("EACCES");

      const process = new FakeDesktopProcess("linux");
      const refused = "The runtime refused the ready update's notification, so the desktop posts it again when the runtime is ready: The database is busy.";

      await DesktopApplicationTests.startWithUpdaterAsync(process, new FakeUpdater(String(record["file"])), files, connection, new FakeElectron(), device);
      await Condition.waitAsync(() => DesktopStartFixture.readErrors(process, refused).length > 0);

      Assert.areEqual(0, files.updateReady.writes.length);
      Assert.isTrue(connection.calls.includes("shell.postNotification"));
    });
  }

  @TestMethod
  public async showsThatTeamRunMustMoveOnlyOnMacOSOutsideAnApplicationsFolder(): Promise<void> {
    const mustMove: unknown[] = [];

    for (const [platform, isInApplications] of [["darwin", false], ["darwin", true], ["linux", false]] as const) {
      const updater = new FakeUpdater();
      updater.check = () => Promise.reject(new UpdateException("TeamRun couldn't reach its update feed."));
      const electron = new FakeElectron();
      electron.app.isInApplications = isInApplications;
      const trusted = DesktopStartFixture.trustedEvent(platform);
      await DesktopApplicationTests.startWithUpdaterAsync(new FakeDesktopProcess(platform), updater, new FakeDeviceFiles(), new FakeRuntimeConnection(), electron);

      electron.ipcMain.invoke("teamrun:updateAction", trusted, "Check");
      await Condition.waitAsync(() => Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "kind") === "Failed");
      mustMove.push(Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "mustMove"));
    }

    Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify(mustMove));
  }

  @TestMethod
  public async logsAnUpdateChecksSettingItCannotRead(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.readSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));

    await DesktopApplicationTests.startWithUpdaterAsync(process, new FakeUpdater(), new FakeDeviceFiles(), connection);

    await Condition.waitAsync(() => DesktopStartFixture.readErrors(process, "The setting shell.updateChecks could not be read for this device, so the desktop keeps its last value: ").length > 0);

    Assert.areEqual(JSON.stringify(["The setting shell.updateChecks could not be read for this device, so the desktop keeps its last value: The database is busy."]), JSON.stringify(DesktopStartFixture.readErrors(process, "The setting shell.updateChecks could not be read for this device, so the desktop keeps its last value: ")));
  }

  @TestMethod
  public async remembersTheUpdateChecksSettingOfThisDevice(): Promise<void> {
    const files = new FakeDeviceFiles();
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.readSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const launcher = new FakeRuntimeLauncher(connection);
    await DesktopApplicationTests.startWithUpdaterAsync(new FakeDesktopProcess("linux"), new FakeUpdater(), files, connection, new FakeElectron(), new FakeDeviceIdentity(), new FakeUpdateCheckLock(), launcher);
    await Condition.waitAsync(() => connection.calls.includes("shell.readSetting"));

    launcher.listener?.onEvent(new Event(ShellEvents.settingsChanged, { name: "shell.updateChecks", device: FakeDeviceIdentity.ID, value: "OnRequest", isSet: true }));
    await Condition.waitAsync(() => files.state.writes.length > 0);

    Assert.areEqual(JSON.stringify([{ updateChecks: "OnRequest" }]), JSON.stringify(files.state.writes));
  }

  @TestMethod
  public async startsFromTheUpdateChecksSettingItRemembered(): Promise<void> {
    const files = new FakeDeviceFiles();
    files.state.kept = { updateChecks: "OnRequest" };
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.readSetting", Response.failure("r", new Failure(FailureCode.Internal, "The database is busy.")));
    const launcher = new FakeRuntimeLauncher(connection);
    await DesktopApplicationTests.startWithUpdaterAsync(new FakeDesktopProcess("linux"), new FakeUpdater(), files, connection, new FakeElectron(), new FakeDeviceIdentity(), new FakeUpdateCheckLock(), launcher);
    await Condition.waitAsync(() => connection.calls.includes("shell.readSetting"));

    launcher.listener?.onEvent(new Event(ShellEvents.settingsChanged, { name: "shell.updateChecks", device: FakeDeviceIdentity.ID, value: "OnRequest", isSet: true }));
    launcher.listener?.onEvent(new Event(ShellEvents.settingsChanged, { name: "shell.updateChecks", device: FakeDeviceIdentity.ID, value: "AtStart", isSet: true }));
    await Condition.waitAsync(() => files.state.writes.length > 0);

    Assert.areEqual(JSON.stringify([{ updateChecks: "AtStart" }]), JSON.stringify(files.state.writes));
  }

  @TestMethod
  public stopsCheckingForUpdatesWhenQuitting(): Promise<void> {
    return DesktopApplicationTests.withReadyFileAsync(async record => {
      const updater = new FakeUpdater(String(record["file"]));
      const files = new FakeDeviceFiles();
      files.updateReady.kept = record;
      const electron = await DesktopApplicationTests.startWithUpdaterAsync(new FakeDesktopProcess("linux"), updater, files);
      const trusted = DesktopStartFixture.trustedEvent("linux");
      await Condition.waitAsync(() => Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "kind") === "Ready");

      electron.app.emit("will-quit");
      const acted = electron.ipcMain.invoke("teamrun:updateAction", trusted, "Check");

      Assert.isFalse(acted as boolean);
      Assert.areEqual(0, updater.checks);
    });
  }

  @TestMethod
  public async readsWhetherItsTrustedWindowIsInFullScreen(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("darwin", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), new FakeDesktopProcess("darwin"));
    const trusted = DesktopStartFixture.trustedEvent("darwin");
    const window = DesktopStartFixture.firstWindow(electron);

    const before = electron.ipcMain.invoke("teamrun:readFullScreen", trusted);
    window.isFullScreenNow = true;
    const after = electron.ipcMain.invoke("teamrun:readFullScreen", trusted);
    const untrusted = electron.ipcMain.invoke("teamrun:readFullScreen", { ...trusted, senderFrame: null });

    Assert.areEqual("[false,true,null]", JSON.stringify([before, after, untrusted]));
  }

  @TestMethod
  public async pointsTheDictionaryDownloadAtItsProfilesOwnFolderAtReadyAndTakesSpellingPreferencesOnlyFromItsOwnWindow(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const trusted = DesktopStartFixture.trustedEvent("linux");
    const untrusted = { sender: { id: 1 }, senderFrame: null };

    const offer = electron.ipcMain.invoke("teamrun:readSpelling", trusted);
    const refused = electron.ipcMain.invoke("teamrun:readSpelling", untrusted);
    electron.ipcMain.send("teamrun:spelling", trusted, false, ["en-US"]);
    electron.ipcMain.send("teamrun:spelling", untrusted, true, []);
    electron.ipcMain.send("teamrun:spelling", trusted, "yes", []);
    electron.ipcMain.send("teamrun:spelling", trusted, true, "en-US");
    electron.ipcMain.send("teamrun:spelling", trusted, true, [1]);
    electron.defaultSession.refusal = new Error("Refused.");
    electron.ipcMain.send("teamrun:spelling", trusted, true, []);

    const profile = electron.app.calls.find(t => t.startsWith("setPath userData "))?.slice("setPath userData ".length) ?? "";

    Assert.areEqual(`url ${pathToFileURL(join(profile, "Dictionaries")).href}/|languages |enabled false|languages |enabled true`, electron.defaultSession.spellCalls.join("|"));
    Assert.isTrue(electron.defaultSession.spellCalls[0]?.startsWith("url file:///") === true, electron.defaultSession.spellCalls.join("|"));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The spell checker refused the languages : Error: Refused.").length);
    Assert.areEqual("{\"languages\":[],\"fallback\":null}", JSON.stringify(offer));
    Assert.isNull(refused);
    Assert.areEqual(3, DesktopStartFixture.readErrors(process, "The window's spelling preferences were rejected: ").length);
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The list of shipped dictionaries could not be read, so no spelling language is offered: ").length);
  }

  @TestMethod
  public async forwardsEachMenuOfItsOwnWindowAndReplacesOrAddsAWordOnlyForIt(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const trusted = DesktopStartFixture.trustedEvent("linux");
    const untrusted = { sender: { id: 1 }, senderFrame: null };
    const contents = electron.windows[0]?.webContents ?? null;
    Assert.isNotNull(contents);

    contents.askForMenu({ x: 10, y: 20, misspelledWord: "wrold", dictionarySuggestions: ["world", "wold"], menuSourceType: "mouse" });
    contents.askForMenu({ x: 3, y: 4, misspelledWord: "", dictionarySuggestions: [], menuSourceType: "keyboard" });
    const answers = [
      electron.ipcMain.invoke("teamrun:replaceMisspelling", trusted, "world"),
      electron.ipcMain.invoke("teamrun:replaceMisspelling", untrusted, "world"),
      electron.ipcMain.invoke("teamrun:replaceMisspelling", trusted, ""),
      electron.ipcMain.invoke("teamrun:replaceMisspelling", trusted, 5),
      electron.ipcMain.invoke("teamrun:replaceMisspelling", trusted, "x".repeat(101)),
      electron.ipcMain.invoke("teamrun:addToDictionary", trusted, "TeamRun"),
      electron.ipcMain.invoke("teamrun:addToDictionary", untrusted, "TeamRun"),
      electron.ipcMain.invoke("teamrun:addToDictionary", trusted, "two words"),
      electron.ipcMain.invoke("teamrun:addToDictionary", trusted, "x".repeat(101)),
      electron.ipcMain.invoke("teamrun:addToDictionary", trusted, 5)
    ];

    Assert.areEqual(JSON.stringify([
      ["teamrun:fieldMenu", { x: 10, y: 20, isKeyboard: false, word: "wrold", suggestions: ["world", "wold"] }],
      ["teamrun:fieldMenu", { x: 3, y: 4, isKeyboard: true, word: "", suggestions: [] }]
    ]), JSON.stringify(contents.sent.filter(t => t[0] === "teamrun:fieldMenu")));
    Assert.areEqual("true,false,false,false,false,true,false,false,false,false", answers.join(","));
    Assert.areEqual("replaceMisspelling world", contents.calls.filter(t => t.startsWith("replace")).join("|"));
    Assert.areEqual("add TeamRun", electron.defaultSession.spellCalls.filter(t => t.startsWith("add")).join("|"));
  }

  @TestMethod
  public async copiesOnlyTextFromItsOwnWindowUpToTheLimit(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const trusted = DesktopStartFixture.trustedEvent("linux");
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
  public async opensOnlyAllowedLinksFromItsOwnWindowAndLogsTheOnesItDoesNotOpen(): Promise<void> {
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), process);
    const trusted = DesktopStartFixture.trustedEvent("linux");
    const open = (url: unknown, event: IIpcEvent = trusted): Promise<boolean> => electron.ipcMain.invoke("teamrun:openLink", event, url) as Promise<boolean>;

    const answers = [
      await open("https://example.com/docs?page=2#top"),
      await open("HTTP://Example.com"),
      await open("mailto:support@example.com?subject=TeamRun"),
      await open(`https://example.com/${"x".repeat(32748)}`),
      await open(`https://example.com/${"x".repeat(32749)}`),
      await open("file:///etc/passwd"),
      await open("javascript:alert(1)"),
      await open("teamrun://open"),
      await open("https://user:secret@example.com/"),
      await open("not a link"),
      await open(5),
      await open("https://example.com/", { sender: { id: 1 }, senderFrame: null })
    ];
    electron.shell.linkFailure = new Error("No browser is installed.");
    answers.push(await open("https://example.com/"));

    Assert.areEqual(JSON.stringify([true, true, true, true, false, false, false, false, false, false, false, false, false]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify([
      "https://example.com/docs?page=2#top",
      "http://example.com/",
      "mailto:support@example.com?subject=TeamRun",
      `https://example.com/${"x".repeat(32748)}`,
      "https://example.com/"
    ]), JSON.stringify(electron.shell.links));
    const lines = process.errors.split("\n").filter(t => t.includes("link")).map(t => t.slice(t.indexOf(" ") + 1));
    Assert.areEqual(JSON.stringify([
      ...Array.from({ length: 7 }, () => "A link was not opened: only well-formed http, https and mailto links without credentials open."),
      "A link could not be opened: Error: No browser is installed."
    ]), JSON.stringify(lines));
  }

  @TestMethod
  public async editsItsOwnWindowWithTheSixEditActionsOnly(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const trusted = DesktopStartFixture.trustedEvent("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    const answers = ["Undo", "Redo", "Cut", "Copy", "Paste", "SelectAll", "undo", "reload", 5].map(t => electron.ipcMain.invoke("teamrun:edit", trusted, t));
    const refused = electron.ipcMain.invoke("teamrun:edit", { sender: { id: 1 }, senderFrame: null }, "Copy");

    Assert.areEqual(JSON.stringify([true, true, true, true, true, true, false, false, false]), JSON.stringify(answers));
    Assert.areEqual(false, refused);
    Assert.areEqual(JSON.stringify(["undo", "redo", "cut", "copy", "paste", "selectAll"]), JSON.stringify(window.webContents.calls));
  }

  @TestMethod
  public async writesAnErrorItsMainProcessDoesNotCatchToItsLogRedactedAndOffersTheLogFolderInItsOwnBox(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      const process = new FakeDesktopProcess("linux", [`--data-dir=${data}`]);
      electron.dialog.answers.push(1);
      DesktopStartFixture.start(electron, process);

      for (const listener of process.exceptionListeners)
        listener(new Error(`The pipe at ${process.homeFolder}/teamrun/runtime.sock broke.`));
      for (const listener of process.rejectionListeners)
        listener(new Error("A request was left unhandled."));
      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => electron.dialog.boxes.length === 2);

      Assert.areEqual(JSON.stringify([1, 1]), JSON.stringify([process.exceptionListeners.length, process.rejectionListeners.length]));
      Assert.isTrue(process.errors.includes("The desktop's main process failed with an uncaught exception: Error: The pipe at ~/teamrun/runtime.sock broke.\n    at "), process.errors);
      Assert.isTrue(process.errors.includes("The desktop's main process failed with an unhandled rejection: Error: A request was left unhandled.\n    at "), process.errors);
      Assert.isTrue(process.errors.includes("desktop-application.test"), "the log keeps the error's stack");
      Assert.areEqual(JSON.stringify([null, null]), JSON.stringify(electron.dialog.boxes.map(t => t.windowId)));
      Assert.areEqual(JSON.stringify([join(data, "logs")]), JSON.stringify(electron.shell.opened));
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async stopsItsTrayHostMonitorWhenItQuitsAfterAMainProcessFailure(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      const process = new FakeDesktopProcess("linux", [`--data-dir=${data}`]);
      electron.dialog.answers.push(2);
      DesktopStartFixture.start(electron, process);
      await electron.app.becomeReadyAsync();
      await Condition.waitAsync(() => process.programs.starts.length === 1);

      for (const listener of process.exceptionListeners)
        listener(new Error("The pipe broke."));
      await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

      Assert.areEqual(1, process.programs.stops);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async namesTheDataFolderItCannotUseOnStandardErrorAndInTheBoxAndOffersToRestartOrQuit(): Promise<void> {
    const electron = new FakeElectron();
    const process = new FakeDesktopProcess("linux", ["/opt/teamrun/teamrun", "--data-dir=/var/locked/teamrun"]);
    const cause = new TypeError("Failed to set path");
    electron.app.pathFailure = cause;
    electron.dialog.answers.push(1);

    const failure = Assert.throws(() => DesktopStartFixture.start(electron, process), UnusableFolderException);
    for (const listener of process.exceptionListeners)
      listener(failure);
    await electron.app.becomeReadyAsync();
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

    const message = `TeamRun cannot use the data folder ${resolve("/var/locked/teamrun")}: TypeError: Failed to set path`;
    Assert.areEqual(message, failure.message);
    Assert.areEqual(cause, failure.cause);
    Assert.isTrue(process.errors.includes(`The desktop's main process failed with an uncaught exception: UnusableFolderException: ${message}`), process.errors);
    Assert.areEqual(JSON.stringify([`${message}\n\nThis happened while TeamRun was starting. Restart TeamRun to try again.`]), JSON.stringify(electron.dialog.boxes.map(t => t.options.detail)));
    Assert.areEqual(JSON.stringify([["Restart TeamRun", "Quit"]]), JSON.stringify(electron.dialog.boxes.map(t => t.options.buttons)));
    Assert.areEqual(JSON.stringify(["setName TeamRun", "exit 0"]), JSON.stringify(electron.app.calls));
  }

  @TestMethod
  public async opensTheLogFolderForItsOwnWindowAndCreatesItFirst(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      DesktopStartFixture.start(electron, new FakeDesktopProcess("linux", [`--data-dir=${data}`]));
      await DesktopStartFixture.openAsync(electron);

      const refused = await (electron.ipcMain.invoke("teamrun:openLogFolder", { sender: { id: 1 }, senderFrame: null }) as Promise<boolean>);
      const isOpened = await (electron.ipcMain.invoke("teamrun:openLogFolder", DesktopStartFixture.trustedEvent("linux")) as Promise<boolean>);

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
  public async installsTheCommandOnMacosForItsOwnWindowAndShowsWhatHappened(): Promise<void> {
    const electron = new FakeElectron();
    const pathCommand = new FakePathCommand();
    DesktopStartFixture.start(electron, new FakeDesktopProcess("darwin"), new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), pathCommand);
    await DesktopStartFixture.openAsync(electron);
    electron.dialog.answers.push(0, 0, 0, 0);
    const answers = [await (electron.ipcMain.invoke("teamrun:installCommand", { sender: { id: 1 }, senderFrame: null }) as Promise<boolean>)];

    for (const outcome of [PathCommandOutcome.Installed, PathCommandOutcome.AlreadyInstalled, PathCommandOutcome.Occupied, PathCommandOutcome.Missing, PathCommandOutcome.Cancelled]) {
      pathCommand.outcome = outcome;
      answers.push(await (electron.ipcMain.invoke("teamrun:installCommand", DesktopStartFixture.trustedEvent("darwin")) as Promise<boolean>));
    }

    Assert.areEqual(JSON.stringify([false, true, true, false, false, false]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["/electron/electron", "/electron/electron", "/electron/electron", "/electron/electron", "/electron/electron"]), JSON.stringify(pathCommand.executablePaths));
    Assert.areEqual(JSON.stringify([
      [1, "info", "The teamrun command is installed.", "/usr/local/bin/teamrun links to the command inside TeamRun. Terminals opened from now on run it as teamrun."],
      [1, "info", "The teamrun command is already installed.", "/usr/local/bin/teamrun already links to the command inside this TeamRun."],
      [1, "warning", "The teamrun command was not installed.", "/usr/local/bin/teamrun is a file that is not a link, so TeamRun leaves it alone. Move or remove it, then install the command again."],
      [1, "warning", "The teamrun command was not installed.", "This build of TeamRun has no command to link; an installed TeamRun has one."]
    ]), JSON.stringify(electron.dialog.boxes.map(t => [t.windowId, t.options.type, t.options.message, t.options.detail])));
  }

  @TestMethod
  public async refusesTheCommandOffMacosAndShowsAndLogsAFailureToInstallIt(): Promise<void> {
    const linux = new FakeElectron();
    const mac = new FakeElectron();
    const process = new FakeDesktopProcess("darwin");
    const pathCommand = new FakePathCommand();
    DesktopStartFixture.start(linux, new FakeDesktopProcess("linux"));
    DesktopStartFixture.start(mac, process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeDeviceFiles(), pathCommand);
    await DesktopStartFixture.openAsync(linux);
    await DesktopStartFixture.openAsync(mac);
    mac.dialog.answers.push(0);
    pathCommand.failure = new PathCommandException("The teamrun command could not be linked at /usr/local/bin/teamrun: Error: Command failed: /usr/bin/osascript");

    const refused = await (linux.ipcMain.invoke("teamrun:installCommand", DesktopStartFixture.trustedEvent("linux")) as Promise<boolean>);
    const failed = await (mac.ipcMain.invoke("teamrun:installCommand", DesktopStartFixture.trustedEvent("darwin")) as Promise<boolean>);
    pathCommand.failure = new RangeError("The fixture broke.");
    const unexpected = await (mac.ipcMain.invoke("teamrun:installCommand", DesktopStartFixture.trustedEvent("darwin")) as Promise<boolean>).then(() => null, (t: unknown) => t);

    Assert.areEqual(JSON.stringify([false, false]), JSON.stringify([refused, failed]));
    Assert.areEqual(0, linux.dialog.boxes.length);
    Assert.areEqual(JSON.stringify([[1, "warning", "The teamrun command was not installed.", "The teamrun command could not be linked at /usr/local/bin/teamrun: Error: Command failed: /usr/bin/osascript"]]),
      JSON.stringify(mac.dialog.boxes.map(t => [t.windowId, t.options.type, t.options.message, t.options.detail])));
    Assert.isTrue(process.errors.includes("The teamrun command could not be linked at /usr/local/bin/teamrun: Error: Command failed: /usr/bin/osascript"), process.errors);
    Assert.isTrue(unexpected instanceof RangeError);
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
      const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), new FakeElectron(), new FakeDeviceIdentity(), ownedProcess);
      const refusal = new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData(refused)));
      const refusedElectron = await DesktopStartFixture.startReadyAsync("linux", refusal, new FakeElectron(), new FakeDeviceIdentity(), refusedProcess);

      electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), { background: "red" });
      refusedElectron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent("linux"), { background: "red" });
      await Condition.waitAsync(() => DesktopStartFixture.firstWindow(refusedElectron).isShown);

      const lines = (await readFile(join(owned, "logs", "desktop.log"), "utf8")).trimEnd().split("\n");
      Assert.areEqual(1, lines.length);
      Assert.isTrue(/^\d{4}-\d\d-\d\dT[\d:.]+Z The window reported an appearance that is not valid/.test(lines[0] ?? ""));
      Assert.isFalse(existsSync(join(refused, "logs")));
      Assert.areEqual(1, DesktopStartFixture.readErrors(refusedProcess, "The window reported").length);
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
      await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), quitting);
      await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(), looping, new FakeDeviceIdentity(), new FakeDesktopProcess("linux", [`--data-dir=${data}`]));

      DesktopStartFixture.firstWindow(quitting).webContents.crashed = true;
      DesktopStartFixture.firstWindow(quitting).webContents.goAway("crashed", 5);
      DesktopStartFixture.firstWindow(looping).webContents.goAway("crashed", 5);
      await Condition.waitAsync(() => DesktopStartFixture.firstWindow(looping).webContents.calls.includes("reload"));
      DesktopStartFixture.firstWindow(looping).webContents.goAway("crashed", 5);
      await Condition.waitAsync(() => looping.shell.opened.length === 1 && quitting.app.calls.includes("quit"));

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
      DesktopStartFixture.start(unopened, unopenedProcess);
      DesktopStartFixture.start(uncreated, uncreatedProcess);
      await DesktopStartFixture.openAsync(unopened);
      await DesktopStartFixture.openAsync(uncreated);
      const answers: boolean[] = [];

      answers.push(await (unopened.ipcMain.invoke("teamrun:openLogFolder", DesktopStartFixture.trustedEvent("linux")) as Promise<boolean>));
      answers.push(await (uncreated.ipcMain.invoke("teamrun:openLogFolder", DesktopStartFixture.trustedEvent("linux")) as Promise<boolean>));

      Assert.areEqual(JSON.stringify([false, false]), JSON.stringify(answers));
      Assert.areEqual(JSON.stringify(["The log folder could not be opened: There is no file manager."]), JSON.stringify(DesktopStartFixture.readErrors(unopenedProcess, "The log folder")));
      Assert.isTrue(DesktopStartFixture.readErrors(uncreatedProcess, "The log folder")[0]?.startsWith("The log folder could not be opened: Error:") === true);
      Assert.areEqual(0, uncreated.shell.opened.length);
    }
    finally {
      await rm(data, { recursive: true, force: true });
    }
  }

  private static async startWithUpdaterAsync(
    process: FakeDesktopProcess,
    updater: FakeUpdater,
    files: FakeDeviceFiles = new FakeDeviceFiles(),
    connection: FakeRuntimeConnection = new FakeRuntimeConnection(),
    electron: FakeElectron = new FakeElectron(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    lock: FakeUpdateCheckLock = new FakeUpdateCheckLock(),
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(connection)): Promise<FakeElectron> {
    DesktopStartFixture.start(electron, process, launcher, device, files, new FakePathCommand(), [], () => Promise.resolve(true), log => {
      log("The updater reported: started");
      return updater;
    }, log => {
      log("The update lock reported: started");
      return lock;
    });
    await DesktopStartFixture.openAsync(electron);
    await setImmediate();
    return electron;
  }

  private static async restartToUpdateAsync(
    platform: string,
    handoff: FakeUpdateHandoff,
    run: (electron: FakeElectron, desktop: FakeDesktopProcess, installation: Installation, launcher: FakeRuntimeLauncher) => Promise<void>,
    target: FakeRuntimeConnection | null = null,
    paints: boolean = true,
    runtimeProcessId: number = process.pid,
    beforeRestartAsync: (desktop: FakeDesktopProcess) => Promise<unknown> = () => Promise.resolve()): Promise<void> {
    await DesktopApplicationTests.withReadyFileAsync(async record => {
      const folder = await mkdtemp(join(tmpdir(), "teamrun-restart-"));
      try {
        const files = new FakeDeviceFiles();
        files.updateReady.kept = record;
        const desktop = new FakeDesktopProcess(platform, [`--device-dir=${folder}`], { SystemRoot: process.env["SystemRoot"] });
        desktop.processId = process.pid;
        desktop.temporaryFolder = folder;
        const electron = new FakeElectron();
        const installations: Installation[] = [];
        const launcher = Object.isNull(target) ? new FakeRuntimeLauncher() : new FakeRuntimeLauncher(new FakeRuntimeConnection(), target);
        DesktopStartFixture.start(electron, desktop, launcher, new FakeDeviceIdentity(), files, new FakePathCommand(), installations, () => Promise.resolve(true),
          () => new FakeUpdater(String(record["file"])), undefined, handoff);
        await DesktopStartFixture.openAsync(electron);
        const [installation] = installations;
        Assert.isDefined(installation);
        if (!Object.isNull(target)) {
          const root = join(folder, "data");
          const discovery = new DataDirectory(root).discoveryFile;
          await mkdir(dirname(discovery), { recursive: true });
          await writeFile(discovery, JSON.stringify(new RuntimeDiscovery("127.0.0.1:52000", "capability-token", runtimeProcessId, desktop.execPath, "0.0.1", 1, "build-fingerprint").toJson()));
          await installation.recordAsync(root);
          if (paints)
            DesktopApplicationTests.paint(electron, platform, DesktopStartFixture.firstWindow(electron));
        }
        const trusted = DesktopStartFixture.trustedEvent(platform);
        await Condition.waitAsync(() => Reflect.get(Object(electron.ipcMain.invoke("teamrun:readUpdate", trusted)), "kind") === "Ready");
        await beforeRestartAsync(desktop);

        const isStarted = electron.ipcMain.invoke("teamrun:updateAction", trusted, "Restart");

        Assert.isTrue(isStarted as boolean);
        await run(electron, desktop, installation, launcher);
      }
      finally {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    });
  }

  private static keptFile(desktop: FakeDesktopProcess): string {
    return join(desktop.temporaryFolder, `${ProductInfo.current.slug}-restart-${basename(Installation.locate(desktop.temporaryFolder, desktop.execPath, desktop.platform))}.json`);
  }

  private static async readKeptAsync(desktop: FakeDesktopProcess): Promise<unknown> {
    const file = DesktopApplicationTests.keptFile(desktop);
    const value: unknown = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null;
    return value;
  }

  private static updateStates(window: FakeDesktopWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "teamrun:updateState").map(t => Reflect.get(Object(t[1]), "kind"));
  }

  private static async withReadyFileAsync(run: (record: JsonObject) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-update-ready-"));
    try {
      const file = join(folder, "TeamRun-linux-x64.AppImage");
      await writeFile(file, "TeamRun 999.0.0");
      await run({ version: "999.0.0", file, sha512: createHash("sha512").update("TeamRun 999.0.0").digest("base64"), notified: false });
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async startRecordingAsync(answer: boolean | Error): Promise<FakeDesktopProcess> {
    const electron = new FakeElectron();
    const desktop = new FakeDesktopProcess("linux");
    const installations: Installation[] = [];
    const recorded: Installation[] = [];
    DesktopStartFixture.start(electron, desktop, undefined, undefined, undefined, undefined, installations, t => {
      recorded.push(t);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    });
    await DesktopStartFixture.openAsync(electron);
    Assert.areEqual(1, recorded.length);
    Assert.areEqual(installations[0], recorded[0]);
    return desktop;
  }

  private static async invokeAsync(electron: FakeElectron, channel: string, event: IIpcEvent, ...values: unknown[]): Promise<Record<string, unknown>> {
    return await (electron.ipcMain.invoke(channel, event, ...values) as Promise<Record<string, unknown>>);
  }

  private static async requestAsync(electron: FakeElectron, event: IIpcEvent, method: unknown, payload: unknown): Promise<Response> {
    return Response.fromJson(await (electron.ipcMain.invoke("teamrun:request", event, method, payload) as Promise<unknown>));
  }

  private static paint(electron: FakeElectron, platform: string, window: FakeDesktopWindow): void {
    electron.ipcMain.send("teamrun:ready", DesktopStartFixture.trustedEvent(platform, window.id), DesktopStartFixture.APPEARANCE);
  }

  private static busy(): Response {
    return Response.failure("r", new Failure(FailureCode.Conflict, "Work is in progress.", { descriptions: ["Indexing the project"] }));
  }

  private static answerStops(connection: FakeRuntimeConnection, answers: Response[]): void {
    connection.deferred.set("shell.stop", () => Promise.resolve(answers.shift() ?? Response.success("r", null)));
  }

  private static stops(connection: FakeRuntimeConnection): unknown[] {
    return connection.payloads.filter((_t, u) => connection.calls[u] === "shell.stop");
  }

  private static quitQuestions(window: FakeDesktopWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "teamrun:quitQuestion").map(t => t[1]);
  }

  private static wireNotification(id: number, title: string): JsonObject {
    return { id: String(id), sequence: id, post: { kind: "clock.alarm", title, severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false };
  }

}
