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
import { Page, PageAuthor, PageKind } from "@noldova/teamrun.protocol";

@TestClass
export class PageTests {
  private static readonly stored: object = {
    id: "p1", chatId: "c1", title: "Options", version: 2, madeBy: { teammateId: "t1", name: "Opus" }, editedBy: { teammateId: null, name: "Sol" },
    path: "/chats/c1/options.html", bytes: 120, createdAt: "2026-11-11T10:00:00.000Z", updatedAt: "2026-11-11T10:05:00.000Z"
  };

  private static readonly json: object = { ...PageTests.stored, kind: "Canvas" };

  @TestMethod
  public roundTripsThroughJsonWithBothAuthors(): void {
    const page = Page.fromJson(PageTests.json);

    Assert.areEqual(JSON.stringify(PageTests.json), JSON.stringify(page.toJson()));
    Assert.areEqual("Opus", page.madeBy.name);
    Assert.isNull(page.editedBy.teammateId);
    Assert.areEqual(PageKind.Canvas, page.kind);
  }

  @TestMethod
  public readsARecordWithoutAKindAsAPage(): void {
    Assert.areEqual(PageKind.Page, Page.fromJson(PageTests.stored).kind);
    Assert.areEqual(PageKind.Page, new Page("p1", "c1", "T", 1, new PageAuthor(null, "Sol"), new PageAuthor(null, "Sol"), "/p.html", 1, "t0", "t1").kind);
  }

  @TestMethod
  public rejectsAnUnknownKindWithItsPath(): void {
    const exception = Assert.throws(() => Page.fromJson({ ...PageTests.json, kind: "board" }), JsonException);

    Assert.areEqual("$.kind", exception.path);
  }

  @TestMethod
  public rejectsAnUnknownKindInTheConstructor(): void {
    const author = new PageAuthor(null, "Sol");

    Assert.throws(() => new Page("p1", "c1", "T", 1, author, author, "/p.html", 1, "t0", "t1", "board" as PageKind), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsInvalidArguments(): void {
    const author = new PageAuthor(null, "Sol");
    const make = (version: number, bytes: number, title: string = "Options"): Page =>
      new Page("p1", "c1", title, version, author, author, "/p.html", bytes, "t0", "t1");

    Assert.throws(() => make(0, 1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1.5, 1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1, -1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1, 0.5), ArgumentOutOfRangeException);
    Assert.throws(() => make(1, 1, " "), ArgumentException);
    Assert.throws(() => new Page(" ", "c1", "T", 1, author, author, "/p.html", 1, "t0", "t1"), ArgumentException);
    Assert.throws(() => new Page("p1", " ", "T", 1, author, author, "/p.html", 1, "t0", "t1"), ArgumentException);
    Assert.throws(() => new Page("p1", "c1", "T", 1, author, author, " ", 1, "t0", "t1"), ArgumentException);
    Assert.throws(() => new Page("p1", "c1", "T", 1, author, author, "/p.html", 1, " ", "t1"), ArgumentException);
    Assert.throws(() => new Page("p1", "c1", "T", 1, author, author, "/p.html", 1, "t0", " "), ArgumentException);
    Assert.areEqual(0, make(1, 0).bytes);
  }

  @TestMethod
  public rejectsAnAuthorWithABlankIdOrName(): void {
    Assert.throws(() => new PageAuthor(" ", "Opus"), ArgumentException);
    Assert.throws(() => new PageAuthor("t1", " "), ArgumentException);
    Assert.throws(() => PageAuthor.fromJson({ teammateId: "t1", name: String.empty }), JsonException);
  }

  @TestMethod
  public rejectsAMissingAuthorWithItsPath(): void {
    const exception = Assert.throws(() => Page.fromJson({ ...PageTests.json, madeBy: { teammateId: "t1" } }), JsonException);

    Assert.areEqual("$.madeBy.name", exception.path);
  }
}
