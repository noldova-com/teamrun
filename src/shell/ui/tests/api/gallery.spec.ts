/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GalleryComponent } from "@noldova/teamrun-shell-ui/gallery";

import * as kit from "../../src/api/index";
import { GalleryComponent as SourceGalleryComponent } from "../../src/app/components/gallery/gallery.component";

describe("the kit's development entry", () => {
  it("publishes the Gallery, which the kit's API leaves out", () => {
    expect(GalleryComponent).toBe(SourceGalleryComponent);
    expect(Object.values(kit)).not.toContain(GalleryComponent);
  });
});
