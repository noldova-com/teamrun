/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ViewedImageMissingException } from "../../../src/app/exceptions/viewed-image-missing.exception";

describe("ViewedImageMissingException", () => {
  it("carries its name and the image's key, and says the image isn't among those to view", () => {
    const exception = new ViewedImageMissingException("k2");

    expect([exception.name, exception.key, exception.message]).toEqual(["ViewedImageMissingException", "k2", "Image k2 isn't among the images to view."]);
  });
});
