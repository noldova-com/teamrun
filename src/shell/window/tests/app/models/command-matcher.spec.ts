/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandMatch } from "../../../src/app/models/command-match";
import { CommandMatcher } from "../../../src/app/models/command-matcher";

describe("CommandMatcher", () => {
  it("matches the query as one run of a title's characters, at its start, middle or end, ignoring case and surrounding spaces", () => {
    expect(["  CLOSE t ", "he", "TAB"].map(t => CommandMatcher.match(t, "TeamRun", "Close the tab"))).toEqual([
      new CommandMatch([0, 1, 2, 3, 4, 5, 6], []), new CommandMatch([7, 8], []), new CommandMatch([10, 11, 12], [])
    ]);
  });

  it("matches a run in the category followed by a space and the title when the title alone has none", () => {
    expect(CommandMatcher.match("notes new", "Notes", "New note")).toEqual(new CommandMatch([0, 1, 2], [0, 1, 2, 3, 4]));
    expect(CommandMatcher.match("run", "TeamRun", "Close the tab")).toEqual(new CommandMatch([], [4, 5, 6]));
    expect(CommandMatcher.match("ab", "Tab", "Close the tab")).toEqual(new CommandMatch([11, 12], []));
  });

  it("marks the characters of the original text when changing case changes its length", () => {
    expect(CommandMatcher.match("tes", "İ", "Notes")).toEqual(new CommandMatch([2, 3, 4], []));
    expect(CommandMatcher.match("İ no", "İ", "Notes")).toEqual(new CommandMatch([0, 1], [0]));
  });

  it("matches the characters a pattern would read as syntax literally", () => {
    expect(CommandMatcher.match("(a.b)", "Notes", "Run (a.b) now")).toEqual(new CommandMatch([4, 5, 6, 7, 8], []));
    expect(CommandMatcher.match("a.b", "Notes", "Run axb now")).toBeNull();
  });

  it("matches nothing for a blank query, characters that are not one run, or a run from the title into the category", () => {
    expect(CommandMatcher.match("  ", "TeamRun", "Close the tab")).toBeNull();
    expect(CommandMatcher.match("ctt", "TeamRun", "Close the tab")).toBeNull();
    expect(CommandMatcher.match("tab tea", "TeamRun", "Close the tab")).toBeNull();
  });
});
