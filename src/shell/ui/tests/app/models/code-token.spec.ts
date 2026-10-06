/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { CodeTokenKind } from "../../../src/app/enums/code-token-kind";
import { CodeToken } from "../../../src/app/models/code-token";

describe("CodeToken", () => {
  it("keeps its text and kind, and takes the token class with its kind's class", () => {
    const tokens = [new CodeToken("return", CodeTokenKind.Control), new CodeToken("// note", CodeTokenKind.Comment)];

    expect(tokens.map(t => [t.text, t.kind, t.className])).toEqual([
      ["return", CodeTokenKind.Control, "tr-code-token tr-code-token-control"],
      ["// note", CodeTokenKind.Comment, "tr-code-token tr-code-token-comment"]
    ]);
  });

  it("takes no class for text without a kind", () => {
    const token = new CodeToken(" ", null);

    expect([token.text, token.kind, token.className]).toEqual([" ", null, null]);
  });
});
