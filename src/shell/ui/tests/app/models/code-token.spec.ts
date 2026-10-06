/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CodeTokenKind } from "../../../src/app/enums/code-token-kind";
import { CodeToken } from "../../../src/app/models/code-token";

describe("CodeToken", () => {
  it("keeps its text and kind, and ends where its text ends", () => {
    const token = new CodeToken(7, "return", CodeTokenKind.Control);

    expect([token.start, token.end, token.text, token.kind]).toEqual([7, 13, "return", CodeTokenKind.Control]);
  });
});
