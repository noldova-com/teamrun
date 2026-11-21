/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PageEditedListRequest } from "@noldova/teamrun.protocol";

@TestClass
export class PageEditedListRequestTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    Assert.areEqual(JSON.stringify({ teammateId: "t-opus" }), JSON.stringify(PageEditedListRequest.fromJson({ teammateId: "t-opus" }).toJson()));
  }

  @TestMethod
  public rejectsABlankOrMissingTeammate(): void {
    Assert.throws(() => new PageEditedListRequest(" "), ArgumentException);
    Assert.throws(() => PageEditedListRequest.fromJson({}), JsonException);
  }
}
