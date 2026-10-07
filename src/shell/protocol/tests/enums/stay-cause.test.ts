/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { StayCause } from "@noldova/teamrun-shell-protocol";

@TestClass
export class StayCauseTests {
  @TestMethod
  public namesEveryCauseByItsMember(): void {
    Assert.areEqual("Kept,SaveFailed", Object.values(StayCause).join(","));
  }
}
