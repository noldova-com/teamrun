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
import { PageListRequest } from "@noldova/teamrun.protocol";

@TestClass
export class PageListRequestTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    Assert.areEqual(JSON.stringify({ chatId: "c1" }), JSON.stringify(PageListRequest.fromJson({ chatId: "c1" }).toJson()));
  }

  @TestMethod
  public rejectsABlankOrMissingChat(): void {
    Assert.throws(() => new PageListRequest(" "), ArgumentException);
    Assert.throws(() => PageListRequest.fromJson({}), JsonException);
  }
}
