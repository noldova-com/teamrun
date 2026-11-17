/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageEventName, PageMethodName } from "@noldova/teamrun.protocol";

import { PageDocumentResources } from "../../../../src/app/services/pages/page-document-resources";

describe("PageDocumentResources", () => {
  it("says how long ago, in minutes under an hour, in hours under a day, then in days", () => {
    const minute = 60_000;

    expect([0, 59_999, minute, 59 * minute, 60 * minute, 23 * 60 * minute + 59 * minute, 24 * 60 * minute, 50 * 60 * minute]
      .map(t => PageDocumentResources.formatAgo(t))).toEqual(["just now", "just now", "1 min ago", "59 min ago", "1 h ago", "23 h ago", "1 d ago", "2 d ago"]);
  });

  it("names a saved file by the page's own file, with .html when it lacks one, from either kind of folder separator", () => {
    expect(["options.html", "pages/Plan.HTML", "C:\\Chats\\c1\\notes", "notes.htm"].map(t => PageDocumentResources.formatFileName(t)))
      .toEqual(["options.html", "Plan.HTML", "notes.html", "notes.htm.html"]);
  });

  it("labels a key as macOS shows it and as Windows and Linux show it", () => {
    expect(["Mod+Equal", "Mod+Minus", "Mod+0", "Mod+W", "Mod+P"].flatMap(t => [true, false].map(u => PageDocumentResources.formatShortcut(t, u))))
      .toEqual(["\u2318=", "Ctrl+=", "\u2318-", "Ctrl+-", "\u23180", "Ctrl+0", "\u2318W", "Ctrl+W", "\u2318P", "Ctrl+P"]);
  });

  it("counts an address as the page's own by its origin and path, whatever its query or fragment, and no address that can't be read", () => {
    const page = "http://127.0.0.1:4100/pages/p1?k=key";

    expect([`${page}#costs`, "http://127.0.0.1:4100/pages/p1?tab=2", "http://127.0.0.1:4100/pages/p2?k=key", "http://127.0.0.1:4101/pages/p1?k=key", "not an address"]
      .map(t => PageDocumentResources.isSamePage(t, page))).toEqual([true, true, false, false, false]);
    expect(PageDocumentResources.isSamePage(page, "not an address")).toBe(false);
  });

  it("names Pages' methods and events as the runtime declares them", () => {
    expect([PageMethodName.PageOpen, PageMethodName.PageList, PageEventName.PageShown].map(t => PageDocumentResources.formatMethod(t)))
      .toEqual(["teamrun.pageOpen", "teamrun.pageList", "teamrun.pageShown"]);
  });
});
