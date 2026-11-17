/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CanvasArtboard, CanvasAxis, CanvasGuide, CanvasPage } from "@noldova/teamrun.protocol";

@TestClass
export class CanvasChecksTests {
  @TestMethod
  public takesAnyFiniteNumberAndRefusesNotANumberOrAnInfinity(): void {
    const guide = (at: number): CanvasGuide => new CanvasGuide("cp1", CanvasAxis.Horizontal, at);

    Assert.throws(() => guide(Number.NaN), ArgumentOutOfRangeException);
    Assert.throws(() => guide(Number.POSITIVE_INFINITY), ArgumentOutOfRangeException);
    Assert.throws(() => guide(Number.NEGATIVE_INFINITY), ArgumentOutOfRangeException);
    Assert.areEqual("-0.5,0,1e+300", [guide(-0.5), guide(0), guide(1e300)].map(t => String(t.at)).join());
  }

  @TestMethod
  public takesAPositiveFiniteSizeAndRefusesZeroANegativeOneOrOneNotFinite(): void {
    const sized = (width: number): CanvasArtboard => new CanvasArtboard("a1", "p1", 1, "cp1", 0, 0, width, 1, "Home", false, false, null);

    Assert.throws(() => sized(0), ArgumentOutOfRangeException);
    Assert.throws(() => sized(-1), ArgumentOutOfRangeException);
    Assert.throws(() => sized(Number.NaN), ArgumentOutOfRangeException);
    Assert.throws(() => sized(Number.POSITIVE_INFINITY), ArgumentOutOfRangeException);
    Assert.areEqual("0.5,1280", [sized(0.5), sized(1280)].map(t => String(t.width)).join());
  }

  @TestMethod
  public takesTextOfUpTo120CharactersCountingEachEmojiOnce(): void {
    Assert.throws(() => new CanvasPage("cp1", "x".repeat(121)), ArgumentOutOfRangeException);
    Assert.throws(() => new CanvasPage("cp1", "\u{1F600}".repeat(121)), ArgumentOutOfRangeException);
    Assert.areEqual(120, [...new CanvasPage("cp1", "\u{1F600}".repeat(120)).name].length);
    Assert.areEqual(120, new CanvasPage("cp1", "x".repeat(120)).name.length);
  }
}
