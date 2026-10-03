/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { StartupService } from "../../../src/app/services/startup.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("StartupService", () => {
  afterEach(() => DesktopBridgeFixture.remove());

  it("starts connecting, then shows the desktop's state and follows it", async () => {
    const bridge = DesktopBridgeFixture.install();
    bridge.startup = { kind: "Failed", details: ["The runtime did not start in time."] };
    const service = TestBed.inject(StartupService);

    expect(service.state().kind).toBe("Connecting");
    await vi.waitFor(() => expect(service.state().kind).toBe("Failed"));
    bridge.publishStartup({ kind: "Ready", details: [] });
    expect(service.state().isReady).toBe(true);
  });

  it("is acting while the desktop carries out the person's choice", async () => {
    const bridge = DesktopBridgeFixture.install();
    const service = TestBed.inject(StartupService);

    const acting = service.actAsync("retry");
    expect(service.isActing()).toBe(true);
    await acting;

    expect(service.isActing()).toBe(false);
    expect(bridge.actions).toEqual(["retry"]);
  });

  it("stops following the desktop's state when destroyed", () => {
    const bridge = DesktopBridgeFixture.install();
    TestBed.inject(StartupService);

    TestBed.resetTestingModule();

    expect(bridge.listenerCount).toBe(0);
  });
});
