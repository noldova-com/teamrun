/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MessageIndexEntry } from "../../../src/app/models/message-index-entry";

describe("MessageIndexEntry", () => {
  it("holds a message's place with no measured height or controls yet", () => {
    const entry = new MessageIndexEntry("m1", 4);

    expect(entry.id).toBe("m1");
    expect(entry.sequence).toBe(4);
    expect(entry.height).toBeNull();
    expect(entry.controls).toBeNull();
  });
});
