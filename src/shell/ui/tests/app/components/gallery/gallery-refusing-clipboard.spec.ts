/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GalleryRefusingClipboard } from "../../../../src/app/components/gallery/gallery-refusing-clipboard";

describe("GalleryRefusingClipboard", () => {
  it("refuses every text, so the Gallery can show a copy that fails", async () => {
    await expect(new GalleryRefusingClipboard().writeTextAsync()).resolves.toBe(false);
  });
});
