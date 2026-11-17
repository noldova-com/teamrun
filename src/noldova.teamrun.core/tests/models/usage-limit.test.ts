/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageLimit } from "@noldova/teamrun.core";

@TestClass
export class UsageLimitTests {
  @TestMethod
  public holdsAReadableResetTimeOrNone(): void {
    Assert.areEqual("2026-11-12T10:00:00.000Z", new UsageLimit("2026-11-12T10:00:00.000Z").resetsAt);
    Assert.isNull(new UsageLimit(null).resetsAt);
    Assert.areEqual("resetsAt", Assert.throws(() => new UsageLimit("soon"), ArgumentException).parameterName);
  }
}
