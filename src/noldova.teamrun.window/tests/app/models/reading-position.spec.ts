/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ReadingPosition } from "../../../src/app/models/reading-position";

describe("ReadingPosition", () => {
  it("holds the message the reader was at, how far into it, and whether the feed followed its end, which it doesn't unless told", () => {
    const position = new ReadingPosition("m3", 3, 40);

    expect(position.messageId).toBe("m3");
    expect(position.sequence).toBe(3);
    expect(position.distance).toBe(40);
    expect(position.isFollowing).toBe(false);
    expect(new ReadingPosition("m3", 3, 40, true).isFollowing).toBe(true);
  });
});
