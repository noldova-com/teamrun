/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TitleSegment } from "../../../src/app/models/title-segment";

describe("TitleSegment", () => {
  it("holds a run of a title's text and whether it matched", () => {
    const segment = new TitleSegment("Clo", true);

    expect([segment.text, segment.isMatch]).toEqual(["Clo", true]);
  });
});
