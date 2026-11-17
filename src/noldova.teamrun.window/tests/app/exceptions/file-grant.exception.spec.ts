/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileGrantException } from "../../../src/app/exceptions/file-grant.exception";
import { Resources } from "../../../src/resources";

describe("FileGrantException", () => {
  it("carries its name, the file's name and a message asking to add it again", () => {
    const exception = new FileGrantException("notes.txt");

    expect(exception.name).toBe("FileGrantException");
    expect(exception.fileName).toBe("notes.txt");
    expect(exception.message).toBe(Resources.attachmentReadFailed);
  });
});
