/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileShare } from "../../../src/app/models/file-share";

describe("FileShare", () => {
  it("keeps its address and discards its grant only on its first release", () => {
    const discard = vi.fn();
    const share = new FileShare("desktop-file://0123456789abcdef0123456789abcdef/", discard);

    share.release();
    share.release();

    expect([share.address, discard.mock.calls.length]).toEqual(["desktop-file://0123456789abcdef0123456789abcdef/", 1]);
  });
});
