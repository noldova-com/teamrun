/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { JsonException } from "@noldova/teamrun-foundation-json";

import { DesktopBridgeException } from "../../../src/app/exceptions/desktop-bridge.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";
import { WindowAppearance } from "../../../src/app/models/window-appearance";
import { DesktopBridgeService } from "../../../src/app/services/desktop-bridge.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("DesktopBridgeService", () => {
  afterEach(() => DesktopBridgeFixture.remove());

  const complete = {
    platform: "linux",
    notifyReady: (): void => undefined,
    onCloseRequest: (): (() => void) => () => undefined,
    answerClose: (): Promise<boolean> => Promise.resolve(true),
    readStartup: (): Promise<unknown> => Promise.resolve(null),
    onStartup: (): (() => void) => () => undefined,
    actOnStartup: (): Promise<boolean> => Promise.resolve(true),
    readLayout: (): Promise<unknown> => Promise.resolve(null),
    writeLayout: (): Promise<boolean> => Promise.resolve(true),
    request: (): Promise<unknown> => Promise.resolve(null),
    onEvent: (): (() => void) => () => undefined,
    readBuild: (): Promise<unknown> => Promise.resolve(null),
    copyText: (): Promise<boolean> => Promise.resolve(true),
    openLogFolder: (): Promise<boolean> => Promise.resolve(true)
  };
  const incomplete: readonly [string, unknown][] = [
    ["nothing", undefined],
    ["a value that is not an object", "teamrun"],
    ["no platform", { ...complete, platform: 1 }],
    ["no notifyReady", { ...complete, notifyReady: null }],
    ["no onCloseRequest", { ...complete, onCloseRequest: null }],
    ["no answerClose", { ...complete, answerClose: null }],
    ["no readStartup", { ...complete, readStartup: null }],
    ["no onStartup", { ...complete, onStartup: null }],
    ["no actOnStartup", { ...complete, actOnStartup: null }],
    ["no readLayout", { ...complete, readLayout: null }],
    ["no writeLayout", { ...complete, writeLayout: null }],
    ["no request", { ...complete, request: null }],
    ["no onEvent", { ...complete, onEvent: null }],
    ["no readBuild", { ...complete, readBuild: null }],
    ["no copyText", { ...complete, copyText: null }],
    ["no openLogFolder", { ...complete, openLogFolder: null }]
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
    const isKept = await service.writeLayoutAsync({ version: 1 });

    expect(before).toBeNull();
    expect(isKept).toBe(true);
    expect(await service.readLayoutAsync()).toEqual({ version: 1 });
  });

  it("passes a request on and resolves the runtime's payload", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.answer = { payload: { title: "Notes" } };

    const payload = await TestBed.inject(DesktopBridgeService).requestAsync("notes.open", { path: "/notes/a.md" });

    expect(payload).toEqual({ title: "Notes" });
    expect(bridge.requests).toEqual([["notes.open", { path: "/notes/a.md" }]]);
  });

  it("rejects a failed request with the failure's code, message and details", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);
    bridge.answer = { failure: { code: "NotFound", message: "There is no such note.", details: { path: "/notes/a.md" } } };

    const failure = await service.requestAsync("notes.open", null).catch((error: unknown) => error);
    bridge.answer = { failure: { code: "Unavailable", message: "TeamRun is not connected to its runtime." } };
    const bare = await service.requestAsync("notes.open", null).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeRequestException);
    expect([(failure as RuntimeRequestException).code, (failure as RuntimeRequestException).message, (failure as RuntimeRequestException).details])
      .toEqual(["NotFound", "There is no such note.", { path: "/notes/a.md" }]);
    expect([(bare as RuntimeRequestException).code, (bare as RuntimeRequestException).details]).toEqual(["Unavailable", undefined]);
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

  it("reads the build, copies text and opens the log folder through the desktop", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(DesktopBridgeService);

    const build = await service.readBuildAsync();
    const isCopied = await service.copyTextAsync("clock: Failed");
    const isOpened = await service.openLogFolderAsync();

    expect([build.productVersion, build.fingerprint, isCopied, isOpened]).toEqual(["1.2.3", "abc123", true, true]);
    expect([bridge.copied, bridge.logFolderOpens]).toEqual([["clock: Failed"], 1]);
  });

  it("refuses a kept layout that is not a JSON object", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.layout = [1, 2];

    await expect(TestBed.inject(DesktopBridgeService).readLayoutAsync()).rejects.toThrow(JsonException);
  });
});
