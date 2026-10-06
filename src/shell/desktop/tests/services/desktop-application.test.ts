/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Event, Failure, FailureCode, NotificationBroadcast, PreShellData, QualifiedName, RecentCommands, Response, RuntimeHandover, ShellEvents } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, DataDirectoryLocator, PreShellDataFoundException, RuntimeBuild, RuntimeEntry, RuntimeHandoverException } from "@noldova/teamrun-shell-runtime";
import { DeviceIdentity, type IIpcEvent, PathCommandException, PathCommandOutcome } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { DesktopStartFixture } from "../fixtures/desktop-start.fixture.js";
import { FakeAppearanceStore } from "../fixtures/fake-appearance-store.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import type { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakePathCommand } from "../fixtures/fake-path-command.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class DesktopApplicationTests {
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

    Assert.isTrue(electron.permissions.request("media") === false);
    Assert.isTrue(electron.permissions.check() === false);
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
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    await setImmediate();
    const [request] = DesktopApplicationTests.closeRequests(window);

    Assert.areEqual(1, DesktopApplicationTests.closeRequests(window).length);
    Assert.areEqual("teamrun:closeRequest", request?.[0]);
    Assert.isFalse(window.isGone);
    Assert.isTrue(electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), request?.[1], true) === true);
    await Condition.waitAsync(() => window.isGone);
  }

  @TestMethod
  public async staysOpenWhenThePageKeepsUnsavedWork(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

    window.close();
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], false);
    await setImmediate();
    window.close();
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 2);

    Assert.isFalse(window.isGone);
    Assert.areEqual(2, DesktopApplicationTests.closeRequests(window).length);
    window.destroy();
  }

  @TestMethod
  public async asksItsWindowBeforeQuittingWithWorkInProgressAndQuitsOnceItHasFinished(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(connection);
    const electron = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const window = DesktopStartFixture.firstWindow(electron);
    const event = DesktopStartFixture.trustedEvent("linux");

    window.close();
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);
    const untrusted = electron.ipcMain.invoke("teamrun:quitAnswer", { ...event, senderFrame: null }, "Wait");
    const waiting = electron.ipcMain.invoke("teamrun:quitAnswer", event, "Wait");
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: ["Indexing the project", "Saving the notes"], sequence: 2 }));
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: "Saving" }));
    const requestsWhileWorking = DesktopApplicationTests.closeRequests(window).length;
    launcher.listener?.onEvent(new Event(ShellEvents.work, { descriptions: [], sequence: 3 }));
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", event, DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await Condition.waitAsync(() => window.isGone);

    Assert.areEqual("false,true,0", [untrusted, waiting, requestsWhileWorking].join(","));
    Assert.areEqual(JSON.stringify([
      { descriptions: ["Indexing the project"], isWaiting: false },
      { descriptions: ["Indexing the project"], isWaiting: true },
      { descriptions: ["Indexing the project", "Saving the notes"], isWaiting: true },
      null
    ]), JSON.stringify(DesktopApplicationTests.quitQuestions(window)));
    Assert.areEqual(2000, connection.timeouts[connection.calls.indexOf("shell.work")]);
    Assert.isFalse(connection.calls.includes("shell.stop"));
  }

  @TestMethod
  public async stopsTheWorkOnceItsWindowHasSavedWhenThePersonChoosesToAndStaysWhenTheyCancel(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    connection.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    connection.answers.set("shell.stop", Response.failure("r", new Failure(FailureCode.Conflict, "The runtime is already stopping.")));
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopStartFixture.firstWindow(electron);
    const event = DesktopStartFixture.trustedEvent("linux");

    window.close();
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 1);
    electron.ipcMain.invoke("teamrun:quitAnswer", event, "Cancel");
    await setImmediate();
    const isOpenAfterCancelling = !window.isGone && DesktopApplicationTests.closeRequests(window).length === 0;
    window.close();
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(window).length === 3);
    electron.ipcMain.invoke("teamrun:quitAnswer", event, "Stop");
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    const stoppedBeforeSaving = connection.calls.includes("shell.stop");
    electron.ipcMain.invoke("teamrun:closeAnswer", event, DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await Condition.waitAsync(() => window.isGone);

    Assert.isTrue(isOpenAfterCancelling);
    Assert.isFalse(stoppedBeforeSaving);
    Assert.areEqual("{\"policy\":\"StopWork\"}", JSON.stringify(connection.payloads[connection.calls.indexOf("shell.stop")]));
    Assert.areEqual(1, DesktopStartFixture.readErrors(process, "The runtime's work could not be stopped: The runtime is already stopping.").length);
  }

  @TestMethod
  public async quitsWithoutAskingWhenTheWorkCannotBeReadInTimeOrTheRuntimeLeavesWhileItAsks(): Promise<void> {
    const slow = new FakeRuntimeConnection();
    slow.deferred.set("shell.work", () => Promise.reject(new ConnectionException("The runtime did not answer shell.work in time.")));
    const process = new FakeDesktopProcess("linux");
    const unanswered = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(slow), new FakeElectron(), new FakeDeviceIdentity(), process);
    const busy = new FakeRuntimeConnection();
    busy.answers.set("shell.work", Response.success("r", { descriptions: ["Indexing the project"], sequence: 1 }));
    const launcher = new FakeRuntimeLauncher(busy, new Promise<FakeRuntimeConnection>(() => undefined));
    const leaving = await DesktopStartFixture.startReadyAsync("linux", launcher);
    const first = DesktopStartFixture.firstWindow(unanswered);
    const second = DesktopStartFixture.firstWindow(leaving);

    first.close();
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(first).length === 1);
    second.close();
    await Condition.waitAsync(() => DesktopApplicationTests.quitQuestions(second).length === 1);
    launcher.listener?.onDisconnected(null);
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(second).length === 1);

    Assert.areEqual(0, DesktopApplicationTests.quitQuestions(first).length);
    Assert.areEqual(2000, slow.timeouts[slow.calls.indexOf("shell.work")]);
    Assert.areEqual(
      1,
      DesktopStartFixture.readErrors(process, "The runtime's work could not be read before quitting, so TeamRun quits without asking: ConnectionException: The runtime did not answer shell.work in time.").length);
    Assert.areEqual("null", JSON.stringify(DesktopApplicationTests.quitQuestions(second).at(-1)));
    first.destroy();
    second.destroy();
  }

  @TestMethod
  public async quitsWithoutAskingWhileNoRuntimeIsConnectedOrWhenItsWorkCannotBeRead(): Promise<void> {
    const connecting = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(new Promise<FakeRuntimeConnection>(() => undefined)));
    const failing = new FakeRuntimeConnection();
    failing.answers.set("shell.work", Response.failure("r", new Failure(FailureCode.Internal, "The runtime is stopping.")));
    const refused = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(failing));
    const first = DesktopStartFixture.firstWindow(connecting);
    const second = DesktopStartFixture.firstWindow(refused);

    first.close();
    second.close();
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(first).length === 1 && DesktopApplicationTests.closeRequests(second).length === 1);

    Assert.areEqual(0, DesktopApplicationTests.quitQuestions(first).length + DesktopApplicationTests.quitQuestions(second).length);
    Assert.isTrue(failing.calls.includes("shell.work"));
    first.destroy();
    second.destroy();
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

    Assert.areEqual(0, DesktopApplicationTests.closeRequests(window).length);
    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async quitsWhenTheLastWindowCloses(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");

    electron.app.emit("window-all-closed");

    Assert.areEqual("quit", electron.app.calls.at(-1));
  }

  @TestMethod
  public async bringsItsWindowForwardWhenStartedAgain(): Promise<void> {
    const electron = await DesktopStartFixture.startReadyAsync("linux");
    const window = DesktopStartFixture.firstWindow(electron);

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
    const electron = await DesktopStartFixture.startReadyAsync("darwin", undefined, undefined, undefined, process, appearance);
    const event = DesktopStartFixture.trustedEvent("darwin");

    electron.ipcMain.send("teamrun:keepAppearance", { sender: { id: 1 }, senderFrame: null }, { "shell.mode": "System" });
    electron.ipcMain.send("teamrun:keepAppearance", event, ["shell.mode"]);
    electron.ipcMain.send("teamrun:keepAppearance", event, { "shell.theme": "x".repeat(4100) });
    electron.ipcMain.send("teamrun:keepAppearance", event, { "shell.mode": "Light" });
    DesktopStartFixture.firstWindow(electron).destroy();
    electron.app.emit("activate");

    Assert.areEqual(JSON.stringify(["/devices/this"]), JSON.stringify(appearance.folders));
    Assert.areEqual(JSON.stringify(["--teamrun-appearance={\"shell.mode\":\"Dark\"}"]), JSON.stringify(electron.windows[0]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify([{ "shell.mode": "Light" }]), JSON.stringify(appearance.writes));
    Assert.areEqual(JSON.stringify(["--teamrun-appearance={\"shell.mode\":\"Light\"}"]), JSON.stringify(electron.windows[1]?.options.webPreferences?.additionalArguments));
    Assert.areEqual(2, DesktopStartFixture.readErrors(process, "The window's appearance preferences are not valid, so they are not kept").length);
  }

  @TestMethod
  public async opensItsWindowInTheDefaultAppearanceWhenTheLastOneCannotBeReadAndReportsOneItCannotKeep(): Promise<void> {
    const appearance = new FakeAppearanceStore();
    appearance.readFailure = new SyntaxError("Unexpected end of JSON input");
    appearance.writeFailure = new Error("The disk is full.");
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopStartFixture.startReadyAsync("linux", undefined, undefined, undefined, process, appearance);

    electron.ipcMain.send("teamrun:keepAppearance", DesktopStartFixture.trustedEvent("linux"), { "shell.mode": "Dark" });
    await Condition.waitAsync(() => DesktopStartFixture.readErrors(process, "The device's appearance could not be kept").length > 0);

    Assert.areEqual(JSON.stringify([]), JSON.stringify(DesktopStartFixture.firstWindow(electron).options.webPreferences?.additionalArguments));
    Assert.areEqual(JSON.stringify(["The device's last appearance could not be read, so the window starts in the default appearance: SyntaxError: Unexpected end of JSON input"]),
      JSON.stringify(DesktopStartFixture.readErrors(process, "The device's last appearance")));
    Assert.areEqual(JSON.stringify(["The device's appearance could not be kept for the next start: Error: The disk is full."]),
      JSON.stringify(DesktopStartFixture.readErrors(process, "The device's appearance could not be kept")));
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
  public keepsAPackagedBuildsDataInThePersonsDataDirectory(): void {
    const electron = new FakeElectron(true, true);
    const process = new FakeDesktopProcess("linux");

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
    return electron.app.becomeReadyAsync().then(async () => {
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
    Assert.areEqual(JSON.stringify([DeviceIdentity.locateFolder("win32", environment, "C:\\Users\\person")]), JSON.stringify(located.folders));
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
    for (const name of DesktopApplicationTests.NOTIFICATION_METHODS)
      connection.answers.set(name, Response.success("r", name));
    connection.answers.set("notes.missing", Response.failure("r", new Failure(FailureCode.NotFound, "There is no such note.")));
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");

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
    for (const name of ["shell.settings", "shell.readSetting", "shell.setSetting", "shell.resetSetting"])
      connection.answers.set(name, Response.success("r", name));
    const electron = await DesktopStartFixture.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopStartFixture.trustedEvent("linux");

    const answers = [
      await DesktopApplicationTests.requestAsync(electron, event, "shell.settings", {}),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.readSetting", { name: "notes.wrapLines", scope: { name: "notes.project", id: "p1" } }),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.setSetting", { name: "shell.panelSize", value: 15 }),
      await DesktopApplicationTests.requestAsync(electron, event, "shell.resetSetting", { name: "shell.panelSize", device: "another" })
    ];
    const sent = connection.calls.flatMap((t, index) => t.includes("Setting") || t === "shell.settings" ? [connection.payloads[index]] : []);

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
    Assert.isFalse(connection.calls.some(t => t.includes("etting") || t.includes("ommand")));
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
    Assert.areEqual(JSON.stringify(["shell.readWindowBounds"]), JSON.stringify(connection.calls));
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
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("win32"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
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
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
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
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
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
    await Condition.waitAsync(() => DesktopApplicationTests.closeRequests(window).length === 1);
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopStartFixture.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
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
  public async catchesAFailureBeforeItFindsItsDataDirectoryAndOffersToRestartOrQuit(): Promise<void> {
    const electron = new FakeElectron();
    const process = new FakeDesktopProcess("linux", ["--data-dir=relative/data"]);
    electron.dialog.answers.push(1);

    const failure = Assert.throws(() => DesktopStartFixture.start(electron, process), ArgumentException);
    for (const listener of process.exceptionListeners)
      listener(failure);
    await electron.app.becomeReadyAsync();
    await Condition.waitAsync(() => electron.app.calls.includes("exit 0"));

    Assert.isTrue(process.errors.includes(`The desktop's main process failed with an uncaught exception: ArgumentException: ${failure.message}`), process.errors);
    Assert.areEqual(JSON.stringify([["Restart TeamRun", "Quit"]]), JSON.stringify(electron.dialog.boxes.map(t => t.options.buttons)));
    Assert.areEqual(JSON.stringify(["setName TeamRun", "exit 0"]), JSON.stringify(electron.app.calls));
  }

  @TestMethod
  public async opensTheLogFolderForItsOwnWindowAndCreatesItFirst(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      DesktopStartFixture.start(electron, new FakeDesktopProcess("linux", [`--data-dir=${data}`]));
      await electron.app.becomeReadyAsync();

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
    DesktopStartFixture.start(electron, new FakeDesktopProcess("darwin"), new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeAppearanceStore(), pathCommand);
    await electron.app.becomeReadyAsync();
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
    DesktopStartFixture.start(mac, process, new FakeRuntimeLauncher(), new FakeDeviceIdentity(), new FakeAppearanceStore(), pathCommand);
    await linux.app.becomeReadyAsync();
    await mac.app.becomeReadyAsync();
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

      DesktopStartFixture.firstWindow(quitting).webContents.goAway("crashed", 5);
      DesktopStartFixture.firstWindow(looping).webContents.goAway("crashed", 5);
      await Condition.waitAsync(() => DesktopStartFixture.firstWindow(looping).webContents.calls.includes("reload"));
      DesktopStartFixture.firstWindow(looping).webContents.goAway("crashed", 5);
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
      DesktopStartFixture.start(unopened, unopenedProcess);
      DesktopStartFixture.start(uncreated, uncreatedProcess);
      await unopened.app.becomeReadyAsync();
      await uncreated.app.becomeReadyAsync();
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

  private static async invokeAsync(electron: FakeElectron, channel: string, event: IIpcEvent, ...values: unknown[]): Promise<Record<string, unknown>> {
    return await (electron.ipcMain.invoke(channel, event, ...values) as Promise<Record<string, unknown>>);
  }

  private static async requestAsync(electron: FakeElectron, event: IIpcEvent, method: unknown, payload: unknown): Promise<Response> {
    return Response.fromJson(await (electron.ipcMain.invoke("teamrun:request", event, method, payload) as Promise<unknown>));
  }

  private static closeRequests(window: FakeDesktopWindow): unknown[][] {
    return window.webContents.sent.filter(t => t[0] === "teamrun:closeRequest");
  }

  private static quitQuestions(window: FakeDesktopWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "teamrun:quitQuestion").map(t => t[1]);
  }

  private static wireNotification(id: number, title: string): JsonObject {
    return { id: String(id), sequence: id, post: { kind: "clock.alarm", title, severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false };
  }

}
