/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";

describe("WindowPartTokens", () => {
  it("provides no window parts unless the build gives them", () => {
    expect(TestBed.inject(WindowPartTokens.sources)).toEqual([]);
    expect(TestBed.inject(WindowPartTokens.menus)).toEqual([]);
    expect(WindowPartTokens.context.toString()).toContain("The window part's context");
  });
});
