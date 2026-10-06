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


import { UpdateAction } from "../../../src/app/enums/update-action";
import { UpdateStateKind } from "../../../src/app/enums/update-state-kind";
import { SettingsPageService } from "../../../src/app/services/settings-page.service";
import { UpdateService } from "../../../src/app/services/update.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("UpdateService", () => {
  let errors: unknown[];
  let bridge: DesktopBridgeFixture;
  let opened: string[];

  const update = (kind: string, fields: object = {}): object => ({ kind, version: null, progress: null, checkedAt: null, reason: null, mustMove: false, ...fields });

  function start(): UpdateService {
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: SettingsPageService, useValue: { open: (page: string) => opened.push(page) } }
      ]
    });
    const service = TestBed.inject(UpdateService);
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
    opened = [];
    bridge = DesktopBridgeFixture.install();
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("reads the desktop's update state and follows its changes, keeping a change that came before the read answered", async () => {
    bridge.update = update("UpToDate", { checkedAt: 1 });
    const service = start();
    await settleAsync(() => service.state().kind === UpdateStateKind.UpToDate);
    bridge.publishUpdate(update("Checking"));

    expect(service.state().kind).toBe(UpdateStateKind.Checking);

    bridge.update = update("UpToDate");
    TestBed.resetTestingModule();
    const later = start();
    bridge.publishUpdate(update("Downloading", { version: "1.3.0", progress: 5 }));
    await settleAsync(() => true);
    await Promise.resolve();

    expect(later.state().kind).toBe(UpdateStateKind.Downloading);
    expect(errors).toEqual([]);
  });

  it("reports a state it cannot read", async () => {
    bridge.update = update("Sleeping");

    start();
    await settleAsync(() => errors.length === 1);

    expect(errors.length).toBe(1);
  });

  it("refuses a state the desktop pushes that it cannot read, keeping the state it had", async () => {
    bridge.update = update("Ready", { version: "1.3.0" });
    const service = start();
    await settleAsync(() => service.state().kind === UpdateStateKind.Ready);

    expect(() => bridge.publishUpdate(update("Ready"))).toThrowError(JsonException);
    expect(() => bridge.publishUpdate(update("UpToDate", { mustMove: true }))).toThrowError(JsonException);
    expect([service.state().kind, service.state().version]).toEqual([UpdateStateKind.Ready, "1.3.0"]);
  });

  it("asks the desktop to act and opens About", async () => {
    bridge.update = update("Failed", { reason: "Offline" });
    const service = start();
    await settleAsync(() => service.state().kind === UpdateStateKind.Failed);

    service.act(UpdateAction.Restart);
    service.act(UpdateAction.Check);
    service.openAbout();
    await settleAsync(() => bridge.updateActions.length === 2);

    expect(bridge.updateActions).toEqual(["Restart", "Check"]);
    expect(opened).toEqual(["About"]);
  });

  it("reports an action the desktop refuses", async () => {
    const service = start();
    bridge.actOnUpdate = () => Promise.reject(new Error("Gone"));

    service.act(UpdateAction.Check);
    await settleAsync(() => errors.length === 1);

    expect((errors[0] as Error).message).toBe("Gone");
  });
});
