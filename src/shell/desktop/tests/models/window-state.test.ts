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
import { ScreenArea, WindowState } from "@noldova/teamrun-shell-desktop";

@TestClass
export class WindowStateTests {
  @TestMethod
  public keepsAPositionSizeAndMaximizedState(): void {
    const state = new WindowState(-200, 40, 900, 600, true);

    Assert.areEqual(-200, state.x);
    Assert.areEqual(40, state.y);
    Assert.areEqual(900, state.width);
    Assert.areEqual(600, state.height);
    Assert.isTrue(state.isMaximized);
  }

  @TestMethod
  public defaultsTo1280By800WithoutAPosition(): void {
    const state = WindowState.createDefault();

    Assert.isNull(state.x);
    Assert.isNull(state.y);
    Assert.areEqual(1280, state.width);
    Assert.areEqual(800, state.height);
    Assert.isFalse(state.isMaximized);
  }

  @TestMethod
  public needsBothCoordinatesOrNeither(): void {
    Assert.throws(() => new WindowState(10, null, 1280, 800, false), ArgumentException);
    Assert.throws(() => new WindowState(null, 10, 1280, 800, false), ArgumentException);
  }

  @TestMethod
  @TestData(10.5, 0, 1280, 800)
  @TestData(0, 0.5, 1280, 800)
  @TestData(0, 0, 639, 800)
  @TestData(0, 0, 1280, 399)
  @TestData(0, 0, 1280.5, 800)
  @TestData(0, 0, 1280, 800.5)
  public rejectsFractionalCoordinatesAndSizesBelowTheMinimum(x: number, y: number, width: number, height: number): void {
    Assert.throws(() => new WindowState(x, y, width, height, false), ArgumentOutOfRangeException);
  }

  @TestMethod
  public acceptsTheMinimumSize(): void {
    Assert.areEqual(640, new WindowState(null, null, 640, 400, false).width);
  }

  @TestMethod
  public writesAndReadsItsJson(): void {
    const json = new WindowState(-1, 2, 1000, 700, true).toJson();

    Assert.areEqual(JSON.stringify({ x: -1, y: 2, width: 1000, height: 700, maximized: true }), JSON.stringify(json));
    Assert.areEqual(JSON.stringify(json), JSON.stringify(WindowState.fromJson(json).toJson()));
    Assert.isNull(WindowState.fromJson({ x: null, y: null, width: 1280, height: 800, maximized: false }).x);
  }

  @TestMethod
  public refusesSavedJsonThatIsNotAState(): void {
    Assert.areEqual("$.width", Assert.throws(() => WindowState.fromJson({ x: null, y: null, height: 800, maximized: false }), JsonException).path);
    Assert.areEqual("$.x", Assert.throws(() => WindowState.fromJson({ x: 1.5, y: 0, width: 1280, height: 800, maximized: false }), JsonException).path);
    const invalid = Assert.throws(() => WindowState.fromJson({ x: 1, y: null, width: 1280, height: 800, maximized: false }), JsonException);
    Assert.areEqual("$: The saved window state is not valid.", invalid.message);
    Assert.isInstanceOf(invalid.cause, ArgumentException);
  }

  @TestMethod
  public keepsAPositionThatShowsOnADisplay(): void {
    const state = new WindowState(1800, 900, 1280, 800, false);

    Assert.areEqual(state, state.placeOn([new ScreenArea(0, 0, 1920, 1040), new ScreenArea(1920, 0, 1920, 1040)]));
    Assert.areEqual(state, state.placeOn([new ScreenArea(-1920, 0, 1920, 1040), new ScreenArea(0, 0, 1920, 1040)]));
  }

  @TestMethod
  public dropsAPositionThatNoDisplayShows(): void {
    const placed = new WindowState(4000, 100, 1000, 700, true).placeOn([new ScreenArea(0, 0, 1920, 1040)]);

    Assert.isNull(placed.x);
    Assert.isNull(placed.y);
    Assert.areEqual(1000, placed.width);
    Assert.isTrue(placed.isMaximized);
    Assert.isNull(new WindowState(0, 0, 1000, 700, false).placeOn([]).x);
  }

  @TestMethod
  public leavesAStateWithoutAPositionAsItIs(): void {
    const state = WindowState.createDefault();

    Assert.areEqual(state, state.placeOn([]));
  }
}
