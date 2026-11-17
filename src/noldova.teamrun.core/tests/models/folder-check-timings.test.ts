/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FolderCheckTimings } from "@noldova/teamrun.core";

@TestClass
export class FolderCheckTimingsTests {
  @TestMethod
  public providesDefaultsAndValidatesEveryTiming(): void {
    const timings = FolderCheckTimings.createDefault();
    const custom = new FolderCheckTimings(5, 7);

    Assert.areEqual(3_000, timings.deadline);
    Assert.areEqual(500, timings.listWait);
    Assert.areEqual("5,7", [custom.deadline, custom.listWait].join(","));
    Assert.areEqual("deadline", Assert.throws(() => new FolderCheckTimings(0, 1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("listWait", Assert.throws(() => new FolderCheckTimings(1, 0), ArgumentOutOfRangeException).parameterName);
  }
}
