/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ImageCopyException } from "../../../src/app/exceptions/image-copy.exception";
import { Resources } from "../../../src/resources";

describe("ImageCopyException", () => {
  it("carries its name and says the image wasn't copied", () => {
    const exception = new ImageCopyException();

    expect(exception.name).toBe("ImageCopyException");
    expect(exception.message).toBe(Resources.imageCopyFailed);
  });
});
