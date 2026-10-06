/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { JsonException } from "@noldova/teamrun-foundation-json";
import { type ProgramStatus, ProgramStatusList } from "@noldova/teamrun-shell-protocol";

import { ProgramStatusService } from "../../../src/app/services/program-status.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("ProgramStatusService", () => {
  let errors: unknown[];
  let bridge: DesktopBridgeFixture;

  const program = (moduleId: string, processId: number, hasExited: boolean = false): object =>
    ({ module: moduleId, program: `/usr/bin/${moduleId}`, processId, startedAt: "2026-10-06T08:00:00.000Z", hasExited });
  const list = (sequence: number, ...programs: object[]): object => ({ programs, sequence });
  const summarize = (programs: readonly ProgramStatus[]): string[] => programs.map(t => `${t.moduleId} ${t.processId} ${t.hasExited}`);

  function start(): ProgramStatusService {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    const service = TestBed.inject(ProgramStatusService);
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

  afterEach(() => {
    vi.restoreAllMocks();
    DesktopBridgeFixture.remove();
  });

  it("reads the programs after the modules, lists one module's, and forgets them when the runtime goes so a new runtime's lower sequence counts", async () => {
    bridge.responses.set("shell.programs", { payload: list(4, program("clock", 11), program("notes", 12, true)) });
    const service = start();

    await settleAsync(() => service.programs().length === 2);
    const clock = summarize(service.ofModule("clock"));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    const whileConnecting = service.programs().length;
    bridge.responses.set("shell.programs", { payload: list(1, program("notes", 21)) });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(() => service.programs().length === 1);

    expect(clock).toEqual(["clock 11 false"]);
    expect(whileConnecting).toBe(0);
    expect(summarize(service.programs())).toEqual(["notes 21 false"]);
    expect(bridge.requests.map(t => t[0])).toEqual(["shell.settings", "shell.modules", "shell.commands", "shell.programs", "shell.settings", "shell.modules", "shell.commands", "shell.programs"]);
    expect(errors).toEqual([]);
  });

  it("follows the event, keeps the list with the higher sequence, ignores other events and reports a list it cannot read", async () => {
    const service = start();
    await settleAsync(() => bridge.requests.some(t => t[0] === "shell.programs"));

    bridge.publishEvent("shell.programsChanged", list(3, program("clock", 11)));
    bridge.publishEvent("shell.programsChanged", list(2));
    bridge.publishEvent("shell.commandsChanged", { commands: [], sequence: 9 });
    bridge.publishEvent("shell.programsChanged", list(4, { ...program("clock", 11), arguments: ["--secret"] }));

    expect(summarize(service.programs())).toEqual(["clock 11 false"]);
    expect(errors.map(t => t instanceof JsonException ? t.path : t)).toEqual(["$.programs.0.arguments"]);
  });

  it("keeps an event that arrives while the read is pending over the older answer", async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.responses.set("shell.programs", new Promise(resolve => {
      answer = resolve;
    }));
    const reads = vi.spyOn(ProgramStatusList, "fromJson");
    const service = start();
    await settleAsync(() => bridge.requests.some(t => t[0] === "shell.programs"));

    bridge.publishEvent("shell.programsChanged", list(2, program("clock", 11, true)));
    answer({ payload: list(1, program("clock", 11)) });
    await vi.waitFor(() => expect(reads).toHaveBeenCalledTimes(2));

    expect(summarize(service.programs())).toEqual(["clock 11 true"]);
  });

  it("drops an answer that arrives after its runtime went", async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.responses.set("shell.programs", new Promise(resolve => {
      answer = resolve;
    }));
    const reads = vi.spyOn(ProgramStatusList, "fromJson");
    const service = start();
    await settleAsync(() => bridge.requests.some(t => t[0] === "shell.programs"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    answer({ payload: list(1, program("clock", 11)) });
    await vi.waitFor(() => expect(reads).toHaveBeenCalledTimes(1));

    expect(service.programs()).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("reports a read that fails", async () => {
    bridge.responses.set("shell.programs", { failure: { code: "Unavailable", message: "The runtime did not answer shell.programs in time." } });

    const service = start();
    await settleAsync(() => errors.length === 1);

    expect((errors[0] as Error).message).toContain("did not answer");
    expect(service.programs()).toEqual([]);
  });
});
