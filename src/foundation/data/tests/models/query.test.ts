/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Query } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TextQuery } from "../fixtures/text-query.fixture.js";

@TestClass
export class QueryTests {
  @TestMethod
  public rendersItselfAsText(): void {
    const query = new TextQuery("SELECT 1");

    Assert.isInstanceOf(query, Query);
    Assert.areEqual("SELECT 1", query.toString());
    Assert.areEqual("SELECT 1", `${query}`);
  }
}
