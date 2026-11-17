/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CanvasAxis, CanvasGuide } from "@noldova/teamrun.protocol";

@TestClass
export class CanvasGuideTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { canvasPage: "cp2", axis: "Vertical", at: 640 };

    const guide = CanvasGuide.fromJson(json);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(guide.toJson()));
    Assert.areEqual(CanvasAxis.Vertical, guide.axis);
  }

  @TestMethod
  public rejectsABlankPageOrAPlaceThatIsNotFinite(): void {
    Assert.throws(() => new CanvasGuide(" ", CanvasAxis.Horizontal, 0), ArgumentException);
    Assert.throws(() => new CanvasGuide("cp1", CanvasAxis.Horizontal, Number.NaN), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsAnUnknownAxisWithItsPath(): void {
    Assert.areEqual("$.axis", Assert.throws(() => CanvasGuide.fromJson({ canvasPage: "cp1", axis: "diagonal", at: 0 }), JsonException).path);
  }

  @TestMethod
  public rejectsAnUnknownAxisInTheConstructor(): void {
    Assert.throws(() => new CanvasGuide("cp1", "diagonal" as CanvasAxis, 0), ArgumentOutOfRangeException);
  }
}
