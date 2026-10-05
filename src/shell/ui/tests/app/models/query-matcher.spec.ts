/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QueryMatcher } from "../../../src/app/models/query-matcher";

describe("QueryMatcher", () => {
  it("finds the first run of the query in a text, ignoring case and the spaces around the query", () => {
    expect(QueryMatcher.find("o", "Show the outline")).toEqual([2]);
    expect(QueryMatcher.find("OPEN", "Open the note")).toEqual([0, 1, 2, 3]);
    expect(QueryMatcher.find("  the n ", "Open the note")).toEqual([5, 6, 7, 8, 9]);
  });

  it("finds nothing for an empty or blank query, or a query the text does not hold as one run", () => {
    expect([QueryMatcher.find("", "Notes"), QueryMatcher.find("   ", "Notes"), QueryMatcher.find("xyz", "Notes"), QueryMatcher.find("nts", "Notes")]).toEqual([[], [], [], []]);
  });

  it("finds the characters of the original text when changing case changes its length", () => {
    expect(QueryMatcher.find("tes", "İ Notes")).toEqual([4, 5, 6]);
    expect(QueryMatcher.find("İ no", "İ Notes")).toEqual([0, 1, 2, 3]);
  });

  it("reads the characters a pattern would treat as syntax literally", () => {
    expect([QueryMatcher.find("(a.b)", "Run (a.b) now"), QueryMatcher.find("a.b", "Run axb now")]).toEqual([[4, 5, 6, 7, 8], []]);
  });
});
