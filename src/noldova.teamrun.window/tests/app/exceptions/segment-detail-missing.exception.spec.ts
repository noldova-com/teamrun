/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SegmentKind } from "../../../src/app/enums/segment-kind";
import { SegmentDetailMissingException } from "../../../src/app/exceptions/segment-detail-missing.exception";

describe("SegmentDetailMissingException", () => {
  it("carries its name and the kind of segment, and says that segment has no detail", () => {
    const exception = new SegmentDetailMissingException(SegmentKind.Activity);

    expect([exception.name, exception.kind, exception.message]).toEqual(["SegmentDetailMissingException", SegmentKind.Activity,
      "A reply's Activity segment has no detail of its own."]);
  });
});
