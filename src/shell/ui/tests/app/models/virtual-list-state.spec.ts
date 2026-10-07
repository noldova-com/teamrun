/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListState } from "../../../src/app/models/virtual-list-state";
import { VirtualListSourceFixture } from "../../fixtures/virtual-list-source.fixture";

describe("VirtualListState", () => {
  it("measures as many rows as its source has at the source's estimate, and reads them through a cache that reports what fails", async () => {
    const source = new VirtualListSourceFixture(3, 26);
    const errors: unknown[] = [];
    const state = new VirtualListState(source, t => errors.push(t));

    state.cache.request(0, 3);
    await source.readAt(0).refuseAsync("gone");

    expect([state.source, state.ledger.count, state.ledger.total, errors]).toEqual([source, 3, 78, ["gone"]]);
  });
});
