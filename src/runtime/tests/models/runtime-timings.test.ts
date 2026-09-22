/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { RuntimeTimings } from "@noldova/teamrun-runtime";

@TestClass
export class RuntimeTimingsTests {
  @TestMethod
  public providesDefaultsAndValidates(): void {
    const timings = RuntimeTimings.createDefault();

    Assert.areEqual(5_000, timings.helloTimeout);
    Assert.areEqual(600_000, timings.callTimeout);
    Assert.areEqual(20_000, timings.launchTimeout);
    Assert.areEqual(100, timings.launchPollInterval);
    Assert.areEqual("launchPollInterval", Assert.throws(() => new RuntimeTimings(1, 1, 1, 0), ArgumentOutOfRangeException).parameterName);
  }
}
