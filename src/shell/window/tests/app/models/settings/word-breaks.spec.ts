/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TextMatch } from "../../../../src/app/models/settings/text-match";
import { WordBreaks } from "../../../../src/app/models/settings/word-breaks";

describe("WordBreaks", () => {
  const split = (text: string, query: string): readonly (readonly string[])[] => WordBreaks.split(TextMatch.split(text, query)).map(t => t.pieces);

  it("breaks an id after each dot and before each capital that follows a letter of another case", () => {
    expect(split("shell.moveTabToNextGroup", "")).toEqual([["shell.", "move", "Tab", "To", "Next", "Group"]]);
    expect(split("notes.openURL", "")).toEqual([["notes.", "open", "URL"]]);
    expect(split("Theme", "")).toEqual([["Theme"]]);
  });

  it("breaks each part of a search at the id's own break points, so a match across a break keeps one part", () => {
    expect(split("shell.splitTabUp", "bu")).toEqual([["shell.", "split", "Ta"], ["b", "U"], ["p"]]);
    expect(split("shell.splitTabUp", "shell.")).toEqual([["shell."], ["split", "Tab", "Up"]]);
    expect(WordBreaks.split(TextMatch.split("shell.splitTabUp", "bu")).map(t => [t.text, t.isMatch, t.breaksBefore])).toEqual([["shell.splitTa", false, false], ["bU", true, false], ["p", false, false]]);
  });

  it("breaks before a part that starts at a word boundary, after a dot or at a capital, but never before the first part", () => {
    const breaks = (text: string, query: string): readonly (readonly [string, boolean])[] => WordBreaks.split(TextMatch.split(text, query)).map(t => [t.text, t.breaksBefore]);

    expect(breaks("shell.moveTabToNextGroup", "Group")).toEqual([["shell.moveTabToNext", false], ["Group", true]]);
    expect(split("shell.moveTabToNextGroup", "Group")).toEqual([["shell.", "move", "Tab", "To", "Next"], ["Group"]]);
    expect(breaks("shell.splitTabUp", "shell.")).toEqual([["shell.", false], ["splitTabUp", true]]);
    expect(breaks("Theme", "the")).toEqual([["The", false], ["me", false]]);
  });
});
