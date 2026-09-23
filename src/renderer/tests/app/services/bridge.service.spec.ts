/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ErrorCode, Event, EventName, MethodName } from "@noldova/teamrun-protocol";

import { FakeTeamRunBridge } from "../../fixtures/fake-teamrun-bridge";
import { BridgeException } from "../../../src/app/exceptions/bridge.exception";
import { Resources } from "../../../src/app/resources";
import { BridgeService, TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { WindowBridgeFactory } from "../../../src/app/services/window-bridge-factory";

describe("BridgeService", () => {
  const configure = (bridge: FakeTeamRunBridge | null): BridgeService => {
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    return TestBed.inject(BridgeService);
  };

  it("numbers requests and returns the payload of a successful response", async () => {
    const bridge = new FakeTeamRunBridge().answer(MethodName.ProjectList, () => ["p"]);
    const service = configure(bridge);

    const first = await service.call(MethodName.ProjectList, null);
    const second = await service.call(MethodName.ProjectList, null);

    expect(service.isAvailable).toBe(true);
    expect(first).toEqual(["p"]);
    expect(second).toEqual(["p"]);
    expect(bridge.requests.map(t => t.id)).toEqual([Resources.formatRequestId(1), Resources.formatRequestId(2)]);
  });

  it("throws the runtime's failure info", async () => {
    const service = configure(new FakeTeamRunBridge().fail(MethodName.ProjectList, ErrorCode.NotFound, "missing"));

    const error = await service.call(MethodName.ProjectList, null).then(() => null, (t: unknown) => t);

    expect(error).toBeInstanceOf(BridgeException);
    expect((error as BridgeException).message).toBe("missing");
    expect((error as BridgeException).info?.name).toBe(ErrorCode.NotFound);
  });

  it("rejects a response that answers another request", async () => {
    const bridge = new FakeTeamRunBridge().answer(MethodName.ProjectList, () => []);
    bridge.mismatchNextResponse = true;
    const service = configure(bridge);

    await expect(service.call(MethodName.ProjectList, null)).rejects.toThrow(Resources.responseMismatch);
  });

  it("delivers events as protocol objects and lets subscribers leave", () => {
    const bridge = new FakeTeamRunBridge();
    const service = configure(bridge);
    const received: Event[] = [];

    const unsubscribe = service.subscribe(event => received.push(event));
    bridge.emit(new Event(EventName.MessageCreated, { id: "m" }));
    unsubscribe();
    bridge.emit(new Event(EventName.MessageUpdated, { id: "m" }));

    expect(received.map(t => t.name)).toEqual([EventName.MessageCreated]);
    expect(bridge.listenerCount).toBe(0);
  });

  it("forwards external links and the folder picker", async () => {
    const bridge = new FakeTeamRunBridge();
    bridge.pickedDirectory = "D:\\repo";
    const service = configure(bridge);

    expect(await service.openExternal("https://teamrun.ai")).toBe(true);
    expect(await service.pickDirectory()).toBe("D:\\repo");
    expect(bridge.openedUrls).toEqual(["https://teamrun.ai"]);
  });

  it("degrades without a bridge", async () => {
    const service = configure(null);

    expect(service.isAvailable).toBe(false);
    await expect(service.call(MethodName.ProjectList, null)).rejects.toThrow(Resources.bridgeMissing);
    expect(await service.openExternal("https://teamrun.ai")).toBe(false);
    expect(await service.pickDirectory()).toBeNull();
    expect(() => service.subscribe(() => undefined)()).not.toThrow();
  });

  it("reads the bridge from the window", () => {
    const bridge = new FakeTeamRunBridge();
    window.teamrun = bridge;
    try {
      expect(WindowBridgeFactory.create()).toBe(bridge);
    }
    finally {
      delete window.teamrun;
    }
    expect(WindowBridgeFactory.create()).toBeNull();
  });
});
