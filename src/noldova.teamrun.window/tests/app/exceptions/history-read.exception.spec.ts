/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HistoryReadException } from "../../../src/app/exceptions/history-read.exception";

describe("HistoryReadException", () => {
  it("carries its name, the range it read and a message naming it", () => {
    const exception = new HistoryReadException(4, 7);

    expect(exception.name).toBe("HistoryReadException");
    expect([exception.start, exception.end]).toEqual([4, 7]);
    expect(exception.message).toBe("The messages from 4 to 6 did not come back in order.");
  });
});
