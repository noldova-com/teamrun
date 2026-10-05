/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("LayoutStoreService", () => {
  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  it("reads and writes the window's layout through the desktop", async () => {
    const bridge = DesktopBridgeFixture.install();
    const store = TestBed.inject(LayoutStoreService);

    expect(await store.readAsync()).toBeNull();
    expect(await store.writeAsync({ version: 1 })).toBe(true);

    expect(bridge.layout).toEqual({ version: 1 });
    expect(await store.readAsync()).toEqual({ version: 1 });
  });

  it("answers that a layout was not kept while the desktop is not connected to the runtime", async () => {
    const bridge = DesktopBridgeFixture.install();
    vi.spyOn(bridge, "writeLayout").mockResolvedValue({ failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });

    expect(await TestBed.inject(LayoutStoreService).writeAsync({ version: 1 })).toBe(false);
  });

  it("fails a write the runtime refused or could not serve", async () => {
    const bridge = DesktopBridgeFixture.install();
    const store = TestBed.inject(LayoutStoreService);
    vi.spyOn(bridge, "writeLayout")
      .mockResolvedValueOnce({ failure: { code: "Internal", message: "The database is busy." } })
      .mockResolvedValueOnce({ failure: { code: "Unavailable", message: "The runtime did not answer in time." } });

    await expect(store.writeAsync({ version: 1 })).rejects.toThrow(new RuntimeRequestException("Internal", "The database is busy."));
    await expect(store.writeAsync({ version: 1 })).rejects.toThrow(new RuntimeRequestException("Unavailable", "The runtime did not answer in time."));
  });
});
