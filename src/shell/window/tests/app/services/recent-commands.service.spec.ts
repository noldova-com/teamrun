/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { DesktopBridgeService } from "../../../src/app/services/desktop-bridge.service";
import { RecentCommandsService } from "../../../src/app/services/recent-commands.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("RecentCommandsService", () => {
  let errors: unknown[];
  let bridge: DesktopBridgeFixture;

  function start(prepare: () => void = () => undefined): RecentCommandsService {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    prepare();
    const service = TestBed.inject(RecentCommandsService);
    TestBed.tick();
    return service;
  }

  async function settleAsync(isDone: () => boolean): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(isDone()).toBe(true);
    });
  }

  beforeEach(() => {
    errors = [];
    bridge = DesktopBridgeFixture.install();
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("reads the list once the runtime is ready, and again after a reconnection", async () => {
    bridge.responses.set("shell.recentCommands", { payload: { ids: ["notes.newNote", "shell.openSettings"] } });
    const service = start();

    await settleAsync(() => service.ids().length === 2);
    const first = service.ids();
    bridge.responses.set("shell.recentCommands", { payload: { ids: ["clock.show"] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(() => service.ids().length === 1);

    expect(first).toEqual(["notes.newNote", "shell.openSettings"]);
    expect(service.ids()).toEqual(["clock.show"]);
    expect(bridge.requests.filter(t => t[0] === "shell.recentCommands")).toEqual([["shell.recentCommands", {}], ["shell.recentCommands", {}]]);
    expect(errors).toEqual([]);
  });

  it("follows the list another window changes, and keeps it over an older read that arrives later", async () => {
    let answer: (value: JsonValue) => void = () => undefined;
    const read = new Promise<JsonValue>(resolve => answer = resolve);
    let isAsked = false;
    const service = start(() => {
      const desktop = TestBed.inject(DesktopBridgeService);
      const request = desktop.requestAsync.bind(desktop);
      vi.spyOn(desktop, "requestAsync").mockImplementation((method, payload) => {
        isAsked ||= method === "shell.recentCommands";
        return method === "shell.recentCommands" ? read : request(method, payload);
      });
    });
    await settleAsync(() => isAsked);

    bridge.publishEvent("shell.recentCommandsChanged", { ids: ["clock.show", "notes.newNote"] });
    bridge.publishEvent("notes.changed", { ids: [] });
    answer({ ids: ["notes.newNote"] });
    await read;

    expect(service.ids()).toEqual(["clock.show", "notes.newNote"]);
  });

  it("puts a command it records first at once and asks the runtime to keep it", () => {
    const service = start();
    bridge.publishEvent("shell.recentCommandsChanged", { ids: ["clock.show", "notes.newNote"] });

    service.record("notes.newNote");

    expect(service.ids()).toEqual(["notes.newNote", "clock.show"]);
    expect(bridge.requests.filter(t => t[0] === "shell.recordCommand")).toEqual([["shell.recordCommand", { id: "notes.newNote" }]]);
  });

  it("leaves a read that fails because the connection to the runtime ended to be dropped, and reads again once ready", async () => {
    bridge.responses.set("shell.recentCommands", { failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });
    const service = start();
    await settleAsync(() => bridge.requests.some(t => t[0] === "shell.recentCommands"));

    bridge.responses.set("shell.recentCommands", { payload: { ids: ["clock.show"] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(() => service.ids().length === 1);

    expect(bridge.requests.filter(t => t[0] === "shell.recentCommands").length).toBe(2);
    expect(errors.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([true]);
  });

  it("reports a list it cannot read, an event it cannot understand and a use it cannot record, leaving one not recorded because the connection ended to be dropped", async () => {
    bridge.responses.set("shell.recentCommands", { failure: { code: "Unavailable", message: "The runtime did not answer shell.recentCommands in time." } });
    bridge.responses.set("shell.recordCommand", { failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });
    const service = start();
    await settleAsync(() => errors.length === 1);

    bridge.publishEvent("shell.recentCommandsChanged", { ids: ["a", "a"] });
    service.record("notes.newNote");
    await settleAsync(() => errors.length === 3);

    expect(service.ids()).toEqual(["notes.newNote"]);
    expect(errors.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([false, false, true]);
  });
});
