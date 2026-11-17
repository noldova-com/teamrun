/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DenyingTurn } from "@noldova/teamrun.core";

@TestClass
export class DenyingTurnTests {
  @TestMethod
  public namesTheThreeTurnsThatDenyEveryAsk(): void {
    Assert.areEqual("Explorer", DenyingTurn.Explorer);
    Assert.areEqual("Title", DenyingTurn.Title);
    Assert.areEqual("Summary", DenyingTurn.Summary);
    Assert.areEqual(3, Object.values(DenyingTurn).length);
  }
}
