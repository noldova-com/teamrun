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
  public isMadeFromARectangle(): void {
    const area = ScreenArea.of({ x: 1920, y: 25, width: 1024, height: 743 });

    Assert.areEqual("1920,25,1024,743", [area.x, area.y, area.width, area.height].join(","));
  }

  @TestMethod
  @TestData(0, 0, 100, 100, 10_000)
  @TestData(1919, 1039, 100, 100, 1)
  @TestData(-99, -99, 100, 100, 1)
  @TestData(1820, 940, 200, 200, 10_000)
  @TestData(-100, -100, 3000, 3000, 1920 * 1040)
  @TestData(1920, 0, 100, 100, 0)
  @TestData(0, 1040, 100, 100, 0)
  @TestData(-100, 0, 100, 100, 0)
  @TestData(0, -100, 100, 100, 0)
  public countsThePixelsARectangleShares(x: number, y: number, width: number, height: number, expected: number): void {
    Assert.areEqual(expected, new ScreenArea(0, 0, 1920, 1040).overlapArea(x, y, width, height));
  }

  @TestMethod
  @TestData(1920, 1040, true)
  @TestData(1280, 800, true)
  @TestData(1921, 800, false)
  @TestData(1280, 1041, false)
  public fitsASizeNoLargerThanItself(width: number, height: number, expected: boolean): void {
    Assert.areEqual(expected, new ScreenArea(0, 0, 1920, 1040).fits(width, height));
  }
}
