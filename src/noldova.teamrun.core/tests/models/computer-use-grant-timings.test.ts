/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ComputerUseGrantTimings } from "@noldova/teamrun.core";

@TestClass
export class ComputerUseGrantTimingsTests {
  @TestMethod
  public providesDefaultsAndValidatesEveryTiming(): void {
    const timings = ComputerUseGrantTimings.createDefault();
    const custom = new ComputerUseGrantTimings(5, 7);

    Assert.areEqual(1_000, timings.describeWait);
    Assert.areEqual(600_000, timings.lifetime);
    Assert.areEqual("5,7", [custom.describeWait, custom.lifetime].join(","));
    Assert.areEqual("describeWait", Assert.throws(() => new ComputerUseGrantTimings(0, 1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("lifetime", Assert.throws(() => new ComputerUseGrantTimings(1, 0), ArgumentOutOfRangeException).parameterName);
  }
}
