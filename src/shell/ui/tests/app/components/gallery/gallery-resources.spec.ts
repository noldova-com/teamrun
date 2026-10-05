/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GalleryResources } from "../../../../src/app/components/gallery/gallery-resources";

describe("GalleryResources", () => {
  it("names a specimen's focus button and a scope by its theme and mode", () => {
    expect([GalleryResources.formatShowFocus("Checkbox"), GalleryResources.formatScope("Default", "Dark")])
      .toEqual(["Show the keyboard focus on the Checkbox", "Default, dark mode"]);
  });
});
