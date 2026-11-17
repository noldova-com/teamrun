/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Page, PageAuthor, PageVersion, PageView } from "@noldova/teamrun.protocol";

@TestClass
export class PageViewTests {
  private static readonly page: object = {
    id: "p1", chatId: "c1", title: "Options", version: 2, madeBy: { teammateId: "t1", name: "Opus" }, editedBy: { teammateId: null, name: "Sol" },
    path: "/chats/c1/options.html", bytes: 120, createdAt: "2026-11-11T10:00:00.000Z", updatedAt: "2026-11-11T10:05:00.000Z", kind: "Page"
  };
  private static readonly json: object = {
    page: PageViewTests.page,
    versions: [{ version: 2, editedBy: { teammateId: null, name: "Sol" }, createdAt: "t2" }, { version: 1, editedBy: { teammateId: "t1", name: "Opus" }, createdAt: "t1" }],
    version: 1, address: "http://127.0.0.1:4000/pages/p1?k=key&v=1", file: "/data/pages/c1/p1.html"
  };

  @TestMethod
  public roundTripsThroughJsonWithThePageAndItsVersionsAndKeepsTheShownVersion(): void {
    const view = PageView.fromJson(PageViewTests.json);

    Assert.areEqual(JSON.stringify(PageViewTests.json), JSON.stringify(view.toJson()));
    Assert.areEqual("2,1", view.versions.map(t => t.version).join(","));
    Assert.areEqual("1,Opus,t1", [view.shown.version, view.shown.editedBy.name, view.shown.createdAt].join(","));
  }

  @TestMethod
  public rejectsAVersionThatIsntKeptABlankAddressOrFileAndABadVersionWithItsPath(): void {
    const page = Page.fromJson(PageViewTests.page);
    const versions = [new PageVersion(2, new PageAuthor(null, "Sol"), "t2")];

    Assert.throws(() => new PageView(page, versions, 1, "http://a", "/f"), ArgumentOutOfRangeException);
    Assert.throws(() => new PageView(page, [], 2, "http://a", "/f"), ArgumentOutOfRangeException);
    Assert.throws(() => new PageView(page, versions, 2, " ", "/f"), ArgumentException);
    Assert.throws(() => new PageView(page, versions, 2, "http://a", " "), ArgumentException);
    const exception = Assert.throws(() => PageView.fromJson({ ...PageViewTests.json, versions: [{ version: "2" }] }), JsonException);
    Assert.isTrue(exception.message.includes("versions"));
  }
}
