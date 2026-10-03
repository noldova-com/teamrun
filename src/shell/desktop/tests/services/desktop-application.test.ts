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
import { setTimeout as delay, setImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity, Event, Failure, FailureCode, PreShellData, QualifiedName, Response, RuntimeHandover } from "@noldova/teamrun-shell-protocol";
import { ConnectionException, DataDirectoryLocator, type LaunchSettings, PreShellDataFoundException, RuntimeBuild, RuntimeEntry, RuntimeHandoverException } from "@noldova/teamrun-shell-runtime";
import { DesktopApplication, DesktopSettings, DeviceIdentity, type IIpcEvent } from "@noldova/teamrun-shell-desktop";

import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeDockHost } from "../fixtures/fake-dock-host.fixture.js";
import type { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class DesktopApplicationTests {
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
    await DesktopApplicationTests.waitAsync(() => window.isShown);

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
    await DesktopApplicationTests.waitAsync(() => window.isShown);

    Assert.isNull(window.backgroundColor);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(JSON.stringify(["The window reported an appearance that is not valid, so it is shown without it: JsonException: $.titleBar: The field is required."]),
      JSON.stringify(DesktopApplicationTests.readErrors(process, "The window reported")));
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
    const [request] = DesktopApplicationTests.closeRequests(window);

    Assert.areEqual(1, DesktopApplicationTests.closeRequests(window).length);
    Assert.areEqual("teamrun:closeRequest", request?.[0]);
    Assert.isFalse(window.isGone);
    Assert.isTrue(electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), request?.[1], true) === true);
    await DesktopApplicationTests.waitAsync(() => window.isGone);
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
  public handsAPackagedBuildOverToANewerBuildAndQuits(): Promise<void> {
    const handover = new RuntimeHandoverException(new RuntimeHandover(new BuildIdentity("2.0.0", 1, "newer"), "/opt/teamrun/teamrun"));
    const process = new FakeDesktopProcess("linux");
    const electron = new FakeElectron(true, true);
    DesktopApplicationTests.start(electron, process, new FakeRuntimeLauncher(handover));
    return electron.app.becomeReadyAsync().then(async () => {
      await setImmediate();

      Assert.areEqual(JSON.stringify(["/opt/teamrun/teamrun"]), JSON.stringify(process.started));
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
    await DesktopApplicationTests.waitAsync(() => window.isShown);

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

    const failure = { code: "Unavailable", message: "This device has no identity, so the window's layout is not kept." };
    Assert.areEqual(JSON.stringify([failure, failure]), JSON.stringify([read["failure"], write["failure"]]));
    Assert.areEqual(1, DesktopApplicationTests.readErrors(process, "This device's identity").length);
  }

  @TestMethod
  public async answersALayoutTheRuntimeCannotKeepAsAFailureAndPassesOnDefects(): Promise<void> {
    const refused = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(new PreShellDataFoundException(new PreShellData("/data/old"))));
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");
    await DesktopApplicationTests.waitAsync(() => connection.calls.length > 0);

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
    connection.answers.set("notes.missing", Response.failure("r", new Failure(FailureCode.NotFound, "There is no such note.")));
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const event = DesktopApplicationTests.trustedEvent("linux");

    const opened = await DesktopApplicationTests.requestAsync(electron, event, "notes.open", { path: "/notes/a.md" });
    const modules = await DesktopApplicationTests.requestAsync(electron, event, "shell.modules", null);
    const missing = await DesktopApplicationTests.requestAsync(electron, event, "notes.missing", null);

    Assert.areEqual(JSON.stringify({ title: "Notes" }), JSON.stringify(opened.payload));
    Assert.areEqual(JSON.stringify({ modules: [] }), JSON.stringify(modules.payload));
    Assert.areEqual(JSON.stringify({ code: "NotFound", message: "There is no such note." }), JSON.stringify(missing.failure?.toJson()));
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
    await DesktopApplicationTests.waitAsync(() => connection.calls.length > 0);

    const unconnected = await DesktopApplicationTests.requestAsync(refused, event, "notes.open", null);
    connection.rejection = new ConnectionException("The connection to the runtime closed.");
    const closed = await DesktopApplicationTests.requestAsync(electron, event, "notes.open", null);
    connection.rejection = new TypeError("A defect.");

    await Assert.throwsAsync(() => DesktopApplicationTests.requestAsync(electron, event, "notes.open", null), TypeError);
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "TeamRun is not connected to its runtime." }), JSON.stringify(unconnected.failure?.toJson()));
    Assert.areEqual(JSON.stringify({ code: "Unavailable", message: "The connection to the runtime closed." }), JSON.stringify(closed.failure?.toJson()));
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
    await delay(500);
    const isShownEarly = window.isShown;
    await DesktopApplicationTests.waitAsync(() => window.isShown, 2_000);
    const waited = Date.now() - started;
    arrive(connection);
    await DesktopApplicationTests.waitAsync(() => window.calls.length > 1);

    Assert.isFalse(isShownEarly);
    Assert.isTrue(waited >= 1_900, `shown after ${waited} ms`);
    Assert.areEqual(JSON.stringify(["show", "setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async savesTheBoundsBeforeTheWindowCloses(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopApplicationTests.firstWindow(electron);
    await DesktopApplicationTests.waitAsync(() => connection.calls.length > 0);
    window.bounds = { x: 300, y: 150, width: 1100, height: 750 };

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await DesktopApplicationTests.waitAsync(() => window.isGone);

    Assert.areEqual(
      JSON.stringify({ x: 300, y: 150, width: 1100, height: 750, maximized: false }),
      JSON.stringify(connection.states.get(`writeWindowBounds:${FakeDeviceIdentity.ID}:main`)));
  }

  @TestMethod
  public async stopsClosingAWindowThatIsGoneWhileItsBoundsAreSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection));
    const window = DesktopApplicationTests.firstWindow(electron);
    await DesktopApplicationTests.waitAsync(() => connection.calls.length > 0);
    connection.onCall = () => window.destroy();

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await DesktopApplicationTests.waitAsync(() => window.isGone);
    await setImmediate();

    Assert.areEqual(JSON.stringify(["close"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async closesEvenWhenTheBoundsCannotBeSaved(): Promise<void> {
    const connection = new FakeRuntimeConnection();
    const process = new FakeDesktopProcess("linux");
    const electron = await DesktopApplicationTests.startReadyAsync("linux", new FakeRuntimeLauncher(connection), new FakeElectron(), new FakeDeviceIdentity(), process);
    const window = DesktopApplicationTests.firstWindow(electron);
    await DesktopApplicationTests.waitAsync(() => connection.calls.length > 0);
    connection.isFailing = true;

    window.close();
    electron.ipcMain.invoke("teamrun:closeAnswer", DesktopApplicationTests.trustedEvent("linux"), DesktopApplicationTests.closeRequests(window)[0]?.[1], true);
    await DesktopApplicationTests.waitAsync(() => window.isGone);

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
    await DesktopApplicationTests.waitAsync(() => window.isShown);

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
    await DesktopApplicationTests.waitAsync(() => window.isShown);

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
    await DesktopApplicationTests.waitAsync(() => window.isShown);
    await (electron.ipcMain.invoke("teamrun:startupAction", DesktopApplicationTests.trustedEvent("linux"), "moveAside") as Promise<boolean>);
    await DesktopApplicationTests.waitAsync(() => window.calls.includes("maximize"));

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
    await DesktopApplicationTests.waitAsync(() => window.isShown && first.calls.includes("shell.readWindowBounds"));

    launcher.listener?.onDisconnected();
    const readsBeforeTheMove = window.boundsReads;
    window.bounds = { x: 40, y: 60, width: 900, height: 640 };
    window.change("move");
    await DesktopApplicationTests.waitAsync(() => window.boundsReads > readsBeforeTheMove, 2000);
    const writesWhileGone = [...first.calls, ...second.calls].filter(t => t === "shell.writeWindowBounds").length;
    reconnect(second);
    await DesktopApplicationTests.waitAsync(() => second.calls.includes("shell.writeWindowBounds"));

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
    await DesktopApplicationTests.waitAsync(() => window.isShown && first.calls.includes("shell.readWindowBounds"));

    launcher.listener?.onDisconnected();
    const readsBeforeTheMove = window.boundsReads;
    window.change("move");
    await DesktopApplicationTests.waitAsync(() => window.boundsReads > readsBeforeTheMove, 2000);
    reconnect(second);
    await DesktopApplicationTests.waitAsync(() => DesktopApplicationTests.readErrors(process, "The window's bounds").length > 0);

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
  public async opensTheLogFolderForItsOwnWindowAndCreatesItFirst(): Promise<void> {
    const data = await mkdtemp(join(tmpdir(), "teamrun-desktop-"));
    try {
      const electron = new FakeElectron();
      DesktopApplicationTests.start(electron, new FakeDesktopProcess("linux", [`--data-dir=${data}`]));
      await electron.app.becomeReadyAsync();

      const refused = await (electron.ipcMain.invoke("teamrun:openLogFolder", { sender: { id: 1 }, senderFrame: null }) as Promise<boolean>);
      const isOpened = await (electron.ipcMain.invoke("teamrun:openLogFolder", DesktopApplicationTests.trustedEvent("linux")) as Promise<boolean>);

      Assert.isFalse(refused);
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
      await DesktopApplicationTests.waitAsync(() => DesktopApplicationTests.firstWindow(refusedElectron).isShown);

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
      await DesktopApplicationTests.waitAsync(() => DesktopApplicationTests.firstWindow(looping).webContents.calls.includes("reload"));
      DesktopApplicationTests.firstWindow(looping).webContents.goAway("crashed", 5);
      await DesktopApplicationTests.waitAsync(() => looping.shell.opened.length === 1);

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

  private static async waitAsync(condition: () => boolean, attempts: number = 400): Promise<void> {
    for (let attempt = 0; attempt < attempts && !condition(); attempt++)
      await delay(5);
    Assert.isTrue(condition());
  }

  private static readErrors(process: FakeDesktopProcess, prefix: string): string[] {
    return process.errors.split("\n").map(t => t.slice(t.indexOf(" ") + 1)).filter(t => t.startsWith(prefix));
  }

  private static start(
    electron: FakeElectron,
    process: FakeDesktopProcess,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity()): LaunchSettings[] {
    const settings: LaunchSettings[] = [];
    DesktopApplication.start(electron, process, DesktopApplicationTests.MODULE_URL, t => {
      settings.push(t);
      return launcher;
    }, t => device.readAsync(t));
    return settings;
  }

  private static async startReadyAsync(
    platform: string,
    launcher: FakeRuntimeLauncher = new FakeRuntimeLauncher(),
    electron: FakeElectron = new FakeElectron(),
    device: FakeDeviceIdentity = new FakeDeviceIdentity(),
    process: FakeDesktopProcess = new FakeDesktopProcess(platform)): Promise<FakeElectron> {
    DesktopApplicationTests.start(electron, process, launcher, device);
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
