/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, BlockCoverage, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class BlockCoverageTests {
  @TestMethod
  public carriesTheBlockState(): void {
    const blockCoverage = new BlockCoverage(7, true);

    Assert.areEqual(7, blockCoverage.line);
    Assert.isTrue(blockCoverage.isTaken);
  }

  @TestMethod
  public carriesAnUntakenBlock(): void {
    Assert.isFalse(new BlockCoverage(3, false).isTaken);
  }

  @TestMethod
  public rejectsANonPositiveLine(): void {
    Assert.throws(() => new BlockCoverage(0, false), ArgumentException);
  }
}
