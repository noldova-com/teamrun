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
import { PageRequest } from "@noldova/teamrun.protocol";

@TestClass
export class PageRequestTests {
  @TestMethod
  public roundTripsThroughJsonWithAVersionOrNull(): void {
    for (const json of [{ pageId: "p1", version: 3 }, { pageId: "p1", version: null }])
      Assert.areEqual(JSON.stringify(json), JSON.stringify(PageRequest.fromJson(json).toJson()));
    Assert.isNull(new PageRequest("p1").version);
  }

  @TestMethod
  public rejectsABlankIdAVersionBelowOneOrNotWholeAndAMissingId(): void {
    Assert.throws(() => new PageRequest(" "), ArgumentException);
    Assert.throws(() => new PageRequest("p1", 0), ArgumentOutOfRangeException);
    Assert.throws(() => new PageRequest("p1", 2.5), ArgumentOutOfRangeException);
    Assert.throws(() => PageRequest.fromJson({ version: 1 }), JsonException);
  }
}
