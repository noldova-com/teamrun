/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DesktopBridgeException } from "../../../src/app/exceptions/desktop-bridge.exception";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { Resources } from "../../../src/resources";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("LayoutStoreService", () => {
  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  it("reads and writes the window's layout through the desktop", async () => {
    const bridge = DesktopBridgeFixture.install();
    const store = TestBed.inject(LayoutStoreService);

    expect(await store.readAsync()).toBeNull();
    await store.writeAsync({ version: 1 });

    expect(bridge.layout).toEqual({ version: 1 });
    expect(await store.readAsync()).toEqual({ version: 1 });
  });

  it("fails a write the desktop did not keep", async () => {
    const bridge = DesktopBridgeFixture.install();
    vi.spyOn(bridge, "writeLayout").mockResolvedValue(false);

    await expect(TestBed.inject(LayoutStoreService).writeAsync({ version: 1 })).rejects.toThrow(new DesktopBridgeException(Resources.layoutNotKept));
  });
});
