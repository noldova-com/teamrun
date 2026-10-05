/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { BuildTokens } from "../../../src/app/models/build-tokens";

describe("BuildTokens", () => {
  it("provides no window parts and no menus unless the build gives them", () => {
    expect(TestBed.inject(BuildTokens.sources)).toEqual([]);
    expect(TestBed.inject(BuildTokens.menus)).toEqual([]);
  });
});
