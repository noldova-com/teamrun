/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { TabStripService } from "../../../src/app/services/tab-strip.service";

describe("TabStripService", () => {
  it("knows which groups' tabs overflow", () => {
    const strips = TestBed.inject(TabStripService);

    strips.setOverflowing(1, true);
    strips.setOverflowing(2, true);
    strips.setOverflowing(1, false);

    expect([strips.isOverflowing(1), strips.isOverflowing(2), strips.isOverflowing(3)]).toEqual([false, true, false]);
  });

  it("holds a request to show a group's tabs until that group takes it", () => {
    const strips = TestBed.inject(TabStripService);

    strips.showList(2);

    expect(strips.takeListRequest(1)).toBe(false);
    expect(strips.listRequest()).toBe(2);
    expect(strips.takeListRequest(2)).toBe(true);
    expect(strips.listRequest()).toBeNull();
  });
});
