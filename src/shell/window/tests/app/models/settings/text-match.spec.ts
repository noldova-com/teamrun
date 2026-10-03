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

  it("finds a query in a text only when the query has something to find", () => {
    expect([TextMatch.contains("Interface font", "FONT"), TextMatch.contains("Interface font", "  "), TextMatch.contains("Mode", "theme")]).toEqual([true, false, false]);
  });
});
