/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProviderTimings } from "@noldova/teamrun-providers";

@TestClass
export class ProviderTimingsTests {
  @TestMethod
  public providesDefaultsAndValidatesEveryTiming(): void {
    const timings = ProviderTimings.createDefault();

    Assert.areEqual(20_000, timings.versionTimeout);
    Assert.areEqual(30_000, timings.signInCheckTimeout);
    Assert.areEqual(60_000, timings.initializeTimeout);
    Assert.areEqual(120_000, timings.requestTimeout);
    Assert.areEqual(20_000, timings.interruptTimeout);
    Assert.areEqual(30_000, timings.interruptGrace);
    Assert.areEqual(3_000, timings.stopGrace);
    Assert.areEqual(8_000, timings.abortGrace);
    Assert.areEqual(100, timings.streamInterval);
    Assert.areEqual(1_000, timings.resumeRetryDelay);
    Assert.areEqual("abortGrace", Assert.throws(() => new ProviderTimings(1, 1, 1, 1, 1, 1, 1, 0, 1, 1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("streamInterval", Assert.throws(() => new ProviderTimings(1, 1, 1, 1, 1, 1, 1, 1, 0, 1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("resumeRetryDelay", Assert.throws(() => new ProviderTimings(1, 1, 1, 1, 1, 1, 1, 1, 1, 0), ArgumentOutOfRangeException).parameterName);
  }
}
