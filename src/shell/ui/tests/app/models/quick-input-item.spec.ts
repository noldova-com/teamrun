/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { QuickInputItem } from "../../../src/app/models/quick-input-item";
import { TitleSegment } from "../../../src/app/models/title-segment";

describe("QuickInputItem", () => {
  it("holds a choice's id, title, icon, detail and key label", () => {
    const item = new QuickInputItem("shell.closeTab", "Close the tab", "close", "TeamRun", "Ctrl+W");

    expect([item.id, item.title, item.icon, item.detail, item.keyLabel, item.matches]).toEqual(["shell.closeTab", "Close the tab", "close", "TeamRun", "Ctrl+W", []]);
    expect(item.segments).toEqual([new TitleSegment("Close the tab", false)]);
  });

  it("splits its title into runs of matched and unmatched characters", () => {
    const item = new QuickInputItem("shell.closeTab", "Close the tab", null, null, null, [0, 1, 6, 10, 11]);

    expect(item.segments).toEqual([
      new TitleSegment("Cl", true), new TitleSegment("ose ", false), new TitleSegment("t", true), new TitleSegment("he ", false), new TitleSegment("ta", true),
      new TitleSegment("b", false)
    ]);
  });

  it("refuses an empty id or title and a match outside the title", () => {
    expect(() => new QuickInputItem(" ", "Close", null, null, null)).toThrow(ArgumentException);
    expect(() => new QuickInputItem("a.b", "", null, null, null)).toThrow(ArgumentException);
    expect(() => new QuickInputItem("a.b", "Close", null, null, null, [5])).toThrow(ArgumentException);
    expect(() => new QuickInputItem("a.b", "Close", null, null, null, [1.5])).toThrow(ArgumentException);
    expect(() => new QuickInputItem("a.b", "Close", null, null, null, [-1])).toThrow(ArgumentException);
  });
});
