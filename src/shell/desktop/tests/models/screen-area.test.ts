/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ScreenArea } from "@noldova/teamrun-shell-desktop";

@TestClass
export class ScreenAreaTests {
  @TestMethod
  public keepsItsEdgesAndSize(): void {
    const area = new ScreenArea(-1920, 24, 1920, 1016);

    Assert.areEqual(-1920, area.x);
    Assert.areEqual(24, area.y);
    Assert.areEqual(1920, area.width);
    Assert.areEqual(1016, area.height);
  }

  @TestMethod
  @TestData(0, 0, 100, 100, true)
  @TestData(1919, 1039, 100, 100, true)
  @TestData(-99, -99, 100, 100, true)
  @TestData(1920, 0, 100, 100, false)
  @TestData(0, 1040, 100, 100, false)
  @TestData(-100, 0, 100, 100, false)
  @TestData(0, -100, 100, 100, false)
  public overlapsARectangleSharingAPixel(x: number, y: number, width: number, height: number, expected: boolean): void {
    Assert.areEqual(expected, new ScreenArea(0, 0, 1920, 1040).overlaps(x, y, width, height));
  }
}
