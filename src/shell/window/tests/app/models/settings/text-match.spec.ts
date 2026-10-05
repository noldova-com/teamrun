/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TextMatch } from "../../../../src/app/models/settings/text-match";

describe("TextMatch", () => {
  const split = (text: string, query: string): string => TextMatch.split(text, query).map(t => t.isMatch ? `[${t.text}]` : t.text).join("");

  it("marks every occurrence of the query, ignoring case and surrounding spaces", () => {
    expect(split("Code text size, in pixels; Size", " size ")).toBe("Code text [size], in pixels; [Size]");
    expect(split("Size", "size")).toBe("[Size]");
    expect(split("Mode", "")).toBe("Mode");
    expect(split("Mode", "theme")).toBe("Mode");
  });

  it("keeps a part whole as its one piece unless it is given its pieces", () => {
    expect([TextMatch.split("Mode", "o").map(t => t.pieces), new TextMatch("splitTab", false, ["split", "Tab"]).pieces]).toEqual([[["M"], ["o"], ["de"]], ["split", "Tab"]]);
  });

  it("finds a query in a text only when the query has something to find", () => {
    expect([TextMatch.contains("Interface font", "FONT"), TextMatch.contains("Interface font", "  "), TextMatch.contains("Mode", "theme")]).toEqual([true, false, false]);
  });
});
