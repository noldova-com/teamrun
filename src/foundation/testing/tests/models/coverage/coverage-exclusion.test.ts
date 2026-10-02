/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, CoverageExclusion, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class CoverageExclusionTests {
  @TestMethod
  public keepsTheFileAndTheReason(): void {
    const exclusion = new CoverageExclusion("main.ts", "Runs only inside Electron.");

    Assert.areEqual("main.ts", exclusion.relativePath);
    Assert.areEqual("Runs only inside Electron.", exclusion.reason);
  }

  @TestMethod
  @TestData(" ", "Runs only inside Electron.")
  @TestData("main.ts", "")
  public needsAFileAndAReason(relativePath: string, reason: string): void {
    Assert.throws(() => new CoverageExclusion(relativePath, reason), ArgumentException);
  }
}
