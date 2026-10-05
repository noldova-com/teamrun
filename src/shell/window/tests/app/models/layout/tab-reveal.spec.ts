/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { TabReveal } from "../../../../src/app/models/layout/tab-reveal";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("TabReveal", () => {
  it("holds the tab to reveal and the request's sequence number", () => {
    const reveal = new TabReveal(LayoutFixture.plan, 3);

    expect([reveal.tab, reveal.sequence]).toEqual([LayoutFixture.plan, 3]);
  });
});
