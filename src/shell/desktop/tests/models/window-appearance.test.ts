/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { JsonException } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WindowAppearance } from "@noldova/teamrun-shell-desktop";

@TestClass
export class WindowAppearanceTests {
  @TestMethod
  @TestData("#181818")
  @TestData("#fff")
  @TestData("#18181880")
  @TestData("rgb(24, 24, 24)")
  @TestData("rgba(24, 24, 24, 0.5)")
  @TestData("rgb(24 24 24 / 50%)")
  public acceptsHexadecimalAndRgbColors(color: string): void {
    const appearance = new WindowAppearance(color, color, color, 35);

    Assert.areEqual(color, appearance.background);
    Assert.areEqual(color, appearance.titleBar);
    Assert.areEqual(color, appearance.titleBarText);
    Assert.areEqual(35, appearance.titleBarHeight);
  }

  @TestMethod
  @TestData("red", "#000", "#000")
  @TestData("#000", "url(x)", "#000")
  @TestData("#000", "#000", "rgb(0, 0, 0); color: red")
  public rejectsOtherColors(background: string, titleBar: string, titleBarText: string): void {
    Assert.throws(() => new WindowAppearance(background, titleBar, titleBarText, 35), ArgumentException);
  }

  @TestMethod
  @TestData(0)
  @TestData(35.5)
  public rejectsAHeightThatIsNotAPositiveInteger(height: number): void {
    Assert.throws(() => new WindowAppearance("#000", "#000", "#000", height), ArgumentOutOfRangeException);
  }

  @TestMethod
  public writesAndReadsItsJson(): void {
    const json = new WindowAppearance("#F8F8F8", "#F8F8F8", "#1E1E1E", 35).toJson();

    Assert.areEqual(JSON.stringify({ background: "#F8F8F8", titleBar: "#F8F8F8", titleBarText: "#1E1E1E", titleBarHeight: 35 }), JSON.stringify(json));
    Assert.areEqual(JSON.stringify(json), JSON.stringify(WindowAppearance.fromJson(json).toJson()));
  }

  @TestMethod
  public refusesAPayloadThatIsNotAnAppearance(): void {
    Assert.areEqual("$.titleBar", Assert.throws(() => WindowAppearance.fromJson({ background: "#000", titleBarText: "#000", titleBarHeight: 35 }), JsonException).path);
    const invalid = Assert.throws(() => WindowAppearance.fromJson({ background: "#000", titleBar: "red", titleBarText: "#000", titleBarHeight: 35 }), JsonException);
    Assert.areEqual("$: The window appearance is not valid.", invalid.message);
    Assert.isInstanceOf(invalid.cause, ArgumentException);
    Assert.throws(() => WindowAppearance.fromJson("#000"), JsonException);
  }
}
