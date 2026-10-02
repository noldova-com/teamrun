/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { LayoutStoreService } from "../../../src/app/services/layout-store.service";

describe("LayoutStoreService", () => {
  it("has nothing saved at first and returns what was written last", async () => {
    const store = TestBed.inject(LayoutStoreService);

    expect(await store.readAsync()).toBeNull();
    await store.writeAsync({ version: 1 });
    await store.writeAsync({ version: 2 });
    expect(await store.readAsync()).toEqual({ version: 2 });
  });
});
