/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ViewedImageMissingException } from "../../../src/app/exceptions/viewed-image-missing.exception";
import { ImageViewerData } from "../../../src/app/models/image-viewer-data";
import { ViewedImage } from "../../../src/app/models/viewed-image";

describe("ImageViewerData", () => {
  const first = ViewedImage.fromData("k1", "c1", "one.png", "image/png", "b25l");
  const second = ViewedImage.fromData("k2", "c1", "two.png", "image/png", "dHdv");

  it("opens on the image of a key among the images, keeping the others to move to", () => {
    const data = ImageViewerData.of("k2", [first, second]);

    expect([data.image, data.images, data.index]).toEqual([second, [first, second], 1]);
  });

  it("refuses a key none of the images has, naming it", () => {
    expect(() => ImageViewerData.of("k3", [first, second])).toThrow(new ViewedImageMissingException("k3"));
  });
});
