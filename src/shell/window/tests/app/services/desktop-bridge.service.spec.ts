/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DesktopBridgeException } from "../../../src/app/exceptions/desktop-bridge.exception";
import { WindowAppearance } from "../../../src/app/models/window-appearance";
import { DesktopBridgeService } from "../../../src/app/services/desktop-bridge.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("DesktopBridgeService", () => {
  afterEach(() => DesktopBridgeFixture.remove());

  const complete = {
    platform: "linux",
    notifyReady: (): void => undefined,
    onCloseRequest: (): (() => void) => () => undefined,
    answerClose: (): Promise<boolean> => Promise.resolve(true)
  };
  const incomplete: readonly [string, unknown][] = [
    ["nothing", undefined],
    ["a value that is not an object", "teamrun"],
    ["no platform", { ...complete, platform: 1 }],
    ["no notifyReady", { ...complete, notifyReady: null }],
    ["no onCloseRequest", { ...complete, onCloseRequest: null }],
    ["no answerClose", { ...complete, answerClose: null }]
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
});
