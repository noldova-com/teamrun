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
import { PageAuthor, PageVersion } from "@noldova/teamrun.protocol";

@TestClass
export class PageVersionTests {
  private static readonly json: object = { version: 3, editedBy: { teammateId: null, name: "You" }, createdAt: "2026-11-11T10:05:00.000Z" };

  @TestMethod
  public roundTripsThroughJson(): void {
    const version = PageVersion.fromJson(PageVersionTests.json);

    Assert.areEqual(JSON.stringify(PageVersionTests.json), JSON.stringify(version.toJson()));
    Assert.areEqual("You", version.editedBy.name);
  }

  @TestMethod
  public rejectsANumberBelowOneOrNotWholeABlankTimeOrAMissingAuthorWithItsPath(): void {
    const author = new PageAuthor(null, "You");

    Assert.throws(() => new PageVersion(0, author, "t0"), ArgumentOutOfRangeException);
    Assert.throws(() => new PageVersion(1.5, author, "t0"), ArgumentOutOfRangeException);
    Assert.throws(() => new PageVersion(1, author, " "), ArgumentException);
    const exception = Assert.throws(() => PageVersion.fromJson({ ...PageVersionTests.json, editedBy: { teammateId: null } }), JsonException);
    Assert.isTrue(exception.message.includes("editedBy"));
  }
}
