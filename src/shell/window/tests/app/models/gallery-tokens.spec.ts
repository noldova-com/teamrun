/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { GalleryTokens } from "../../../src/app/models/gallery-tokens";

describe("GalleryTokens", () => {
  it("provides no Gallery unless the build gives it", () => {
    expect(TestBed.inject(GalleryTokens.component)).toBeNull();
  });
});
