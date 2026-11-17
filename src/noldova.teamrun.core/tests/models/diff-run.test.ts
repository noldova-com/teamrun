/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiffRun } from "@noldova/teamrun.core";

@TestClass
export class DiffRunTests {
  @TestMethod
  public keepsWhereItStartsInEachTextAndHowManyLinesItRemovesAndAdds(): void {
    const run = new DiffRun(4, 6, 2, 3);

    Assert.areEqual(4, run.oldAt);
    Assert.areEqual(6, run.newAt);
    Assert.areEqual(2, run.removed);
    Assert.areEqual(3, run.added);
  }
}
