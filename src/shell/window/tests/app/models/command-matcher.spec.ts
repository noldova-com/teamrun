/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MatchKind } from "../../../src/app/enums/match-kind";
import { CommandMatch } from "../../../src/app/models/command-match";
import { CommandMatcher } from "../../../src/app/models/command-matcher";

describe("CommandMatcher", () => {
  it("matches a title's start first, ignoring case and surrounding spaces", () => {
    expect(CommandMatcher.match("  CLOSE t ", "Close the tab")).toEqual(new CommandMatch(MatchKind.Prefix, [0, 1, 2, 3, 4, 5, 6]));
  });

  it("then matches runs of letters at the starts of words, across word separators", () => {
    expect(CommandMatcher.match("ctt", "Close the tab")).toEqual(new CommandMatch(MatchKind.WordStarts, [0, 6, 10]));
    expect(CommandMatcher.match("thta", "Close the tab")).toEqual(new CommandMatch(MatchKind.WordStarts, [6, 7, 10, 11]));
    expect(CommandMatcher.match("the tab", "Close the tab")).toEqual(new CommandMatch(MatchKind.WordStarts, [6, 7, 8, 9, 10, 11, 12]));
    expect(CommandMatcher.match("ns", "notes.sync")).toEqual(new CommandMatch(MatchKind.WordStarts, [0, 6]));
  });

  it("tries later words and shorter runs when a word's run leaves the rest unmatched", () => {
    expect(CommandMatcher.match("to", "Open the tools")).toEqual(new CommandMatch(MatchKind.WordStarts, [9, 10]));
    expect(CommandMatcher.match("aab", "aa ab")).toEqual(new CommandMatch(MatchKind.WordStarts, [0, 3, 4]));
  });

  it("then matches the letters anywhere in order, and nothing when they are missing or empty", () => {
    expect(CommandMatcher.match("lse", "Close the tab")).toEqual(new CommandMatch(MatchKind.Subsequence, [1, 3, 4]));
    expect(CommandMatcher.match("xyz", "Close the tab")).toBeNull();
    expect(CommandMatcher.match("tabs", "Close the tab")).toBeNull();
    expect(CommandMatcher.match("   ", "Close the tab")).toBeNull();
  });
});
