/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import { ContributionMatch } from "../../../src/app/models/contribution-match";

@Component({ template: "" })
class ListComponent {
}

describe("ContributionMatch", () => {
  it("holds how to load a contribution's component and the context it runs in", async () => {
    const load = (): Promise<Type<unknown>> => Promise.resolve(ListComponent);
    const match = new ContributionMatch(load, null);

    expect([match.loadComponent, match.context]).toEqual([load, null]);
    expect(await match.loadComponent()).toBe(ListComponent);
  });
});
