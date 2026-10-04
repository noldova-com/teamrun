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

  it("matches a run in the title followed by a space and the category, the title's first", () => {
    expect(CommandMatcher.match("tab tea", "TeamRun", "Close the tab")).toEqual(new CommandMatch([10, 11, 12], [0, 1, 2]));
    expect(CommandMatcher.match("run", "TeamRun", "Close the tab")).toEqual(new CommandMatch([], [4, 5, 6]));
    expect(CommandMatcher.match("ab", "Tab", "Close the tab")).toEqual(new CommandMatch([11, 12], []));
  });

  it("matches nothing when the characters are not one run, or run from the category into the title", () => {
    expect(CommandMatcher.match("ctt", "TeamRun", "Close the tab")).toBeNull();
    expect(CommandMatcher.match("run clo", "TeamRun", "Close the tab")).toBeNull();
  });
});
