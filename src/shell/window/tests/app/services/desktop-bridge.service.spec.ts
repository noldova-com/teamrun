/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { JsonException } from "@noldova/teamrun-foundation-json";

import { QuitChoice } from "../../../src/app/enums/quit-choice";
import { UpdateAction } from "../../../src/app/enums/update-action";
import { DesktopBridgeException } from "../../../src/app/exceptions/desktop-bridge.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";
import type { FieldMenuRequest } from "../../../src/app/models/field-menu-request";
import type { QuitQuestion } from "../../../src/app/models/quit-question";
import { WindowAppearance } from "../../../src/app/models/window-appearance";
import { DesktopBridgeService } from "../../../src/app/services/desktop-bridge.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("DesktopBridgeService", () => {
  afterEach(() => DesktopBridgeFixture.remove());

  const complete = {
    platform: "linux",
    processor: "x64",
    notifyReady: (): void => undefined,
    notifyAppearance: (): void => undefined,
    onCloseRequest: (): (() => void) => () => undefined,
    answerClose: (): Promise<boolean> => Promise.resolve(true),
    onUpdateSaveRequest: (): (() => void) => () => undefined,
    answerUpdateSave: (): Promise<boolean> => Promise.resolve(true),
    readStartup: (): Promise<unknown> => Promise.resolve(null),
    onStartup: (): (() => void) => () => undefined,
    actOnStartup: (): Promise<boolean> => Promise.resolve(true),
    readLayout: (): Promise<unknown> => Promise.resolve(null),
    writeLayout: (): Promise<unknown> => Promise.resolve({ payload: null }),
    request: (): Promise<unknown> => Promise.resolve(null),
    onEvent: (): (() => void) => () => undefined,
    readBuild: (): Promise<unknown> => Promise.resolve(null),
    copyText: (): Promise<boolean> => Promise.resolve(true),
    openLogFolder: (): Promise<boolean> => Promise.resolve(true),
    openLink: (): Promise<boolean> => Promise.resolve(true),
    installCommand: (): Promise<boolean> => Promise.resolve(true),
    readUpdate: (): Promise<unknown> => Promise.resolve(null),
    onUpdate: (): (() => void) => () => undefined,
    actOnUpdate: (): Promise<boolean> => Promise.resolve(true),
    keepAppearance: (): void => undefined,
    readSpelling: (): Promise<unknown> => Promise.resolve(null),
    keepSpelling: (): void => undefined,
    onFieldMenu: (): (() => void) => () => undefined,
    replaceMisspelling: (): Promise<boolean> => Promise.resolve(true),
    onNotificationOpened: (): (() => void) => () => undefined,
    onQuitQuestion: (): (() => void) => () => undefined,
    answerQuit: (): Promise<boolean> => Promise.resolve(true),
    logModule: (): void => undefined,
    logError: (): void => undefined
  };
  const incomplete: readonly [string, unknown][] = [
    ["nothing", undefined],
    ["a value that is not an object", "teamrun"],
    ["no platform", { ...complete, platform: 1 }],
    ["no processor", { ...complete, processor: null }],
    ["no notifyReady", { ...complete, notifyReady: null }],
    ["no notifyAppearance", { ...complete, notifyAppearance: null }],
    ["no onCloseRequest", { ...complete, onCloseRequest: null }],
    ["no answerClose", { ...complete, answerClose: null }],
    ["no onUpdateSaveRequest", { ...complete, onUpdateSaveRequest: null }],
    ["no answerUpdateSave", { ...complete, answerUpdateSave: null }],
    ["no readStartup", { ...complete, readStartup: null }],
    ["no onStartup", { ...complete, onStartup: null }],
    ["no actOnStartup", { ...complete, actOnStartup: null }],
    ["no readLayout", { ...complete, readLayout: null }],
    ["no writeLayout", { ...complete, writeLayout: null }],
    ["no request", { ...complete, request: null }],
    ["no onEvent", { ...complete, onEvent: null }],
    ["no readBuild", { ...complete, readBuild: null }],
    ["no copyText", { ...complete, copyText: null }],
    ["no openLogFolder", { ...complete, openLogFolder: null }],
    ["no openLink", { ...complete, openLink: null }],
    ["no installCommand", { ...complete, installCommand: null }],
    ["no readUpdate", { ...complete, readUpdate: null }],
    ["no onUpdate", { ...complete, onUpdate: null }],
    ["no actOnUpdate", { ...complete, actOnUpdate: null }],
    ["no keepAppearance", { ...complete, keepAppearance: null }],
    ["no readSpelling", { ...complete, readSpelling: null }],
    ["no keepSpelling", { ...complete, keepSpelling: null }],
    ["no onFieldMenu", { ...complete, onFieldMenu: null }],
    ["no replaceMisspelling", { ...complete, replaceMisspelling: null }],
    ["no onNotificationOpened", { ...complete, onNotificationOpened: null }],
    ["no onQuitQuestion", { ...complete, onQuitQuestion: null }],
    ["no answerQuit", { ...complete, answerQuit: null }],
    ["no logModule", { ...complete, logModule: null }],
    ["no logError", { ...complete, logError: null }]
  ];

  for (const [name, value] of incomplete)
    it(`refuses a bridge with ${name}`, () => {
      DesktopBridgeFixture.installValue(value);

      expect(() => TestBed.inject(DesktopBridgeService)).toThrowError(DesktopBridgeException);
    });

  it("accepts a complete bridge", () => {
    DesktopBridgeFixture.installValue(complete);

    expect(TestBed.inject(DesktopBridgeService).isMac).toBe(false);
  });

  it("knows when it runs on macOS", () => {
    DesktopBridgeFixture.install("darwin");

    expect(TestBed.inject(DesktopBridgeService).isMac).toBe(true);
  });

  it("reports the appearance as JSON", () => {
    const bridge = DesktopBridgeFixture.install();

    TestBed.inject(DesktopBridgeService).notifyReady(new WindowAppearance("rgb(1, 2, 3)", "rgb(4, 5, 6)", "rgb(7, 8, 9)", 35));

    expect(bridge.appearances).toEqual([{ background: "rgb(1, 2, 3)", titleBar: "rgb(4, 5, 6)", titleBarText: "rgb(7, 8, 9)", titleBarHeight: 35 }]);
  });

  it("reports a change of the appearance as JSON, apart from the first report", () => {
    const bridge = DesktopBridgeFixture.install();

    TestBed.inject(DesktopBridgeService).notifyAppearance(new WindowAppearance("rgb(1, 2, 3)", "rgb(4, 5, 6)", "rgb(7, 8, 9)", 35));

    expect(bridge.changes).toEqual([{ background: "rgb(1, 2, 3)", titleBar: "rgb(4, 5, 6)", titleBarText: "rgb(7, 8, 9)", titleBarHeight: 35 }]);
    expect(bridge.appearances).toEqual([]);
  });

  it("passes close requests on until unsubscribed and answers them", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);
    const requests: string[] = [];

    const unsubscribe = service.onCloseRequest(t => requests.push(t));
    bridge.requestClose("first");
    unsubscribe();
    bridge.requestClose("second");

    expect(requests).toEqual(["first"]);
    expect(await service.answerCloseAsync("first", false)).toBe(true);
    expect(bridge.answers).toEqual(["first:false"]);
  });

  it("passes an update's save requests on until unsubscribed and answers them with what did not save", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);
    const requests: string[] = [];

    const unsubscribe = service.onUpdateSaveRequest(t => requests.push(t));
    bridge.requestUpdateSave("first");
    unsubscribe();
    bridge.requestUpdateSave("second");

    expect(requests).toEqual(["first"]);
    expect(await service.answerUpdateSaveAsync("first", ["Notes couldn't save"])).toBe(true);
    expect(bridge.updateSaveAnswers).toEqual(["first:Notes couldn't save"]);
  });

  it("reads and follows the startup state until unsubscribed, and passes the person's choice on", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.startup = { kind: "PreShellData", details: ["/data/old"] };
    const service = TestBed.inject(DesktopBridgeService);
    const states: string[] = [];

    const initial = await service.readStartupAsync();
    const unsubscribe = service.onStartup(t => states.push(t.kind));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    unsubscribe();
    bridge.publishStartup({ kind: "Ready", details: [] });

    expect([initial.kind, initial.details]).toEqual(["PreShellData", ["/data/old"]]);
    expect(states).toEqual(["Connecting"]);
    expect(await service.actOnStartupAsync("moveAside")).toBe(true);
    expect(bridge.actions).toEqual(["moveAside"]);
  });

  it("keeps the window's layout through the desktop and reads none before it is kept", async () => {
    DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);

    const before = await service.readLayoutAsync();
    await service.writeLayoutAsync({ version: 1 });

    expect(before).toBeNull();
    expect(await service.readLayoutAsync()).toEqual({ version: 1 });
  });

  it("rejects a layout the desktop could not read or write with the runtime's failure", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);
    vi.spyOn(bridge, "readLayout").mockResolvedValue({ failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });
    vi.spyOn(bridge, "writeLayout").mockResolvedValue({ failure: { code: "Unavailable", message: "The runtime did not answer shell.writeLayout in time." } });

    await expect(service.readLayoutAsync()).rejects.toThrow(new RuntimeDisconnectedException("TeamRun is not connected to its runtime."));
    await expect(service.writeLayoutAsync({ version: 1 })).rejects.toThrow(new RuntimeRequestException("Unavailable", "The runtime did not answer shell.writeLayout in time."));
  });

  it("passes a request on and resolves the runtime's payload", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.answer = { payload: { title: "Notes" } };

    const payload = await TestBed.inject(DesktopBridgeService).requestAsync("notes.open", { path: "/notes/a.md" });

    expect(payload).toEqual({ title: "Notes" });
    expect(bridge.requests).toEqual([["notes.open", { path: "/notes/a.md" }]]);
  });

  it("rejects a failed request with the failure's code, message and details, and one whose connection ended as disconnected", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);
    bridge.answer = { failure: { code: "NotFound", message: "There is no such note.", details: { path: "/notes/a.md" } } };

    const failure = await service.requestAsync("notes.open", null).catch((error: unknown) => error);
    bridge.answer = { failure: { code: "Unavailable", message: "The runtime did not answer notes.open in time." } };
    const bare = await service.requestAsync("notes.open", null).catch((error: unknown) => error);
    bridge.answer = { failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } };
    const disconnected = await service.requestAsync("notes.open", null).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeRequestException);
    expect([(failure as RuntimeRequestException).code, (failure as RuntimeRequestException).message, (failure as RuntimeRequestException).details])
      .toEqual(["NotFound", "There is no such note.", { path: "/notes/a.md" }]);
    expect([(bare as RuntimeRequestException).code, (bare as RuntimeRequestException).details]).toEqual(["Unavailable", undefined]);
    expect(bare).not.toBeInstanceOf(RuntimeDisconnectedException);
    expect(disconnected).toBeInstanceOf(RuntimeDisconnectedException);
  });

  it("refuses an answer that is not a JSON object", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.answer = "payload";

    await expect(TestBed.inject(DesktopBridgeService).requestAsync("notes.open", null)).rejects.toThrow(JsonException);
  });

  it("passes the runtime's events on until unsubscribed", () => {
    const bridge = DesktopBridgeFixture.install();
    const events: [string, unknown][] = [];

    const unsubscribe = TestBed.inject(DesktopBridgeService).onEvent((name, payload) => events.push([name, payload]));
    bridge.publishEvent("notes.changed", { path: "/notes/a.md" });
    unsubscribe();
    bridge.publishEvent("notes.changed", null);

    expect(events).toEqual([["notes.changed", { path: "/notes/a.md" }]]);
  });

  it("reads the build, copies text, opens the log folder and links, and installs the command through the desktop", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);

    const build = await service.readBuildAsync();
    const isCopied = await service.writeTextAsync("clock: Failed");
    const isOpened = await service.openLogFolderAsync();
    const isLinkOpened = await service.openLinkAsync("https://example.com/");
    bridge.isLinkOpened = false;
    const isRefusedLinkOpened = await service.openLinkAsync("file:///etc/passwd");
    const isInstalled = await service.installCommandAsync();

    expect([build.productVersion, build.fingerprint, isCopied, isOpened, isLinkOpened, isRefusedLinkOpened, isInstalled]).toEqual(["1.2.3", "abc123", true, true, true, false, true]);
    expect([bridge.copied, bridge.logFolderOpens, bridge.links, bridge.commandInstalls]).toEqual([["clock: Failed"], 1, ["https://example.com/", "file:///etc/passwd"], 1]);
  });

  it("reads the update's state, follows its changes and acts on it through the desktop, and names the processor", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.processor = "arm64";
    bridge.update = { kind: "Ready", version: "1.3.0", progress: null, checkedAt: null, reason: null, mustMove: false };
    const service = TestBed.inject(DesktopBridgeService);
    const states: string[] = [];

    const state = await service.readUpdateAsync();
    const stop = service.onUpdate(t => states.push(t.kind));
    bridge.publishUpdate({ kind: "Checking", version: null, progress: null, checkedAt: null, reason: null, mustMove: false });
    stop();
    bridge.publishUpdate({ kind: "UpToDate", version: null, progress: null, checkedAt: null, reason: null, mustMove: false });
    const isDone = await service.actOnUpdateAsync(UpdateAction.Restart);

    expect([state.kind, state.version, states, isDone, bridge.updateActions, service.processor]).toEqual(["Ready", "1.3.0", ["Checking"], true, ["Restart"], "arm64"]);
  });

  it("passes on the id of a notification opened from the operating system and ignores a blank one", () => {
    const bridge = DesktopBridgeFixture.install();
    const opened: string[] = [];

    const stop = TestBed.inject(DesktopBridgeService).onNotificationOpened(t => opened.push(t));
    bridge.publishNotificationOpened("n2");
    bridge.publishNotificationOpened(" ");
    stop();
    bridge.publishNotificationOpened("n3");

    expect(opened).toEqual(["n2"]);
  });

  it("passes on the device's last appearance and keeps the window's", () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.appearance = { "shell.mode": "Dark" };
    const service = TestBed.inject(DesktopBridgeService);

    service.keepAppearance({ "shell.mode": "Light" });

    expect(service.initialAppearance).toEqual({ "shell.mode": "Dark" });
    expect(bridge.keptAppearances).toEqual([{ "shell.mode": "Light" }]);
  });

  it("reads the spelling languages the desktop offers and keeps the window's spelling preferences", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: "en-US" });
    const service = TestBed.inject(DesktopBridgeService);

    const offer = await service.readSpellingAsync();
    service.keepSpelling(true, ["en-US"]);

    expect([offer.languages, offer.fallback]).toEqual([["en-US"], "en-US"]);
    expect(bridge.keptSpellings).toEqual([[true, ["en-US"]]]);
  });

  it("passes on the desktop's field menus as requests, and replaces a word through the desktop", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);
    const requests: FieldMenuRequest[] = [];

    const stop = service.onFieldMenu(t => requests.push(t));
    bridge.publishFieldMenu({ x: 10, y: 20, isKeyboard: false, word: "wrold", suggestions: ["world"] });
    stop();
    bridge.publishFieldMenu({ x: 1, y: 2, isKeyboard: true, word: "", suggestions: [] });
    const answer = await service.replaceMisspellingAsync("world");

    expect(requests.map(t => [t.x, t.y, t.isKeyboard, t.toContext()])).toEqual([[10, 20, false, { word: "wrold", suggestions: ["world"] }]]);
    expect(answer).toBe(true);
    expect(bridge.replacements).toEqual(["world"]);
  });

  it("passes on the question about work in progress or its end, answers it and writes a module's log lines through the desktop", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);
    const questions: (QuitQuestion | null)[] = [];

    const stop = service.onQuitQuestion(t => questions.push(t));
    bridge.askToQuit({ descriptions: ["Indexing the project"], isWaiting: true });
    bridge.askToQuit(null);
    stop();
    bridge.askToQuit(null);
    const isTaken = await service.answerQuitAsync(QuitChoice.Wait);
    service.logModule("clock", "Ticked");
    service.logError("clock", "Error: It broke.");

    expect(questions.map(t => t === null ? null : [t.descriptions, t.isWaiting])).toEqual([[["Indexing the project"], true], null]);
    expect([isTaken, bridge.quitAnswers, bridge.logged, bridge.errorsLogged]).toEqual([true, ["Wait"], ["clock: Ticked"], [["clock", "Error: It broke."]]]);
  });

  it("refuses a kept layout that is not a JSON object", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.layout = [1, 2];

    await expect(TestBed.inject(DesktopBridgeService).readLayoutAsync()).rejects.toThrow(JsonException);
  });
});
