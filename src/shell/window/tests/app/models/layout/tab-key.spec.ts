/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { TabKey } from "../../../../src/app/models/layout/tab-key";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";

describe("TabKey", () => {
  it("reads a view or document tab back from its key, keeping slashes in its instance", () => {
    expect(TabKey.parse("view/notes.list")).toEqual(new ViewTab("notes.list"));
    expect(TabKey.parse("view/terminal.shell/1")).toEqual(new ViewTab("terminal.shell", "1"));
    expect(TabKey.parse("document/notes.note/a/b")).toEqual(new DocumentTab("notes.note", "a/b"));
  });

  it("reads no tab from an unknown kind, a name that is not a contribution name or a blank instance", () => {
    expect(["panel/notes.list", "view", "view/Notes", "document/notes.note/ ", ""].map(t => TabKey.parse(t))).toEqual([null, null, null, null, null]);
  });
});
