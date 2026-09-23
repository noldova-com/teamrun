/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { AppUpdateCommand, AppUpdateState, AppUpdateStatus } from "@noldova/teamrun-protocol";

import { FakeTeamRunBridge } from "../../fixtures/fake-teamrun-bridge";
import { DeferredResponse } from "../../fixtures/deferred-response";
import { Resources } from "../../../src/app/resources";
import { AppUpdatesService } from "../../../src/app/services/app-updates.service";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";

describe("AppUpdatesService", () => {
  it("ignores a stale initial snapshot, prevents duplicate commands and releases its subscription", async () => {
    const bridge = new FakeTeamRunBridge();
    const status = new DeferredResponse();
    bridge.updateHandler = () => status.promise;
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const service = TestBed.inject(AppUpdatesService);
    const candidate = new AppUpdateState(AppUpdateStatus.Available, "0.0.1", "0.0.2", null, null, null, true);
    bridge.emitUpdate(candidate);
    await service.execute(AppUpdateCommand.Check);
    expect(bridge.updateCommands).toEqual([AppUpdateCommand.Status]);
    status.resolve(new AppUpdateState(AppUpdateStatus.Idle, "0.0.1", null, null, null, null, true).toJson());
    await status.promise;
    await Promise.resolve();
    expect(service.state()?.status).toBe(AppUpdateStatus.Available);
    bridge.updateHandler = null;
    await service.execute(AppUpdateCommand.Download);
    expect(bridge.updateCommands).toEqual([AppUpdateCommand.Status, AppUpdateCommand.Download]);
    TestBed.resetTestingModule();
    expect(bridge.updateListeners.size).toBe(0);
  });

  it("shows a safe bridge failure and recovers on retry", async () => {
    const bridge = new FakeTeamRunBridge();
    bridge.updateHandler = () => Promise.reject(new Error("internal detail"));
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const service = TestBed.inject(AppUpdatesService);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(service.error()).toBe(Resources.updateBridgeFailed);
    bridge.updateHandler = null;
    await service.execute(AppUpdateCommand.Status);
    expect(service.error()).toBeNull();
    expect(service.state()?.status).toBe(AppUpdateStatus.Disabled);
  });

  it("does not change its state after destruction or require a desktop bridge", async () => {
    const bridge = new FakeTeamRunBridge();
    const status = new DeferredResponse();
    bridge.updateHandler = () => status.promise;
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const service = TestBed.inject(AppUpdatesService);
    TestBed.resetTestingModule();
    status.resolve(bridge.updateState.toJson());
    await status.promise;
    await Promise.resolve();
    await service.execute(AppUpdateCommand.Check);
    expect(service.state()).toBeNull();
    expect(bridge.updateCommands).toEqual([AppUpdateCommand.Status]);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: null }] });
    const browser = TestBed.inject(AppUpdatesService);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(browser.state()).toBeNull();
    expect(browser.error()).toBeNull();
  });
});
