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
  private static readonly PRIMARY: ScreenArea = new ScreenArea(0, 0, 1920, 1040);

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
    const state = WindowState.createDefault(new ScreenArea(0, 0, 1920, 1040));

    Assert.isNull(state.x);
    Assert.isNull(state.y);
    Assert.areEqual(1280, state.width);
    Assert.areEqual(800, state.height);
    Assert.isFalse(state.isMaximized);
  }

  @TestMethod
  @TestData(1024, 743, 921, 668)
  @TestData(1024, 728, 921, 655)
  @TestData(1366, 728, 1229, 655)
  @TestData(1400, 900, 1260, 800)
  @TestData(1280, 800, 1152, 720)
  @TestData(600, 380, 640, 400)
  public defaultsToNoMoreThanNineTenthsOfTheWorkAreaOnEachSide(areaWidth: number, areaHeight: number, width: number, height: number): void {
    const state = WindowState.createDefault(new ScreenArea(0, 25, areaWidth, areaHeight));

    Assert.areEqual(`,,${width},${height},false`, [state.x, state.y, state.width, state.height, state.isMaximized].join(","));
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

    Assert.areEqual(state, state.placeOn([new ScreenArea(0, 0, 1920, 1040), new ScreenArea(1920, 0, 1920, 1040)], WindowStateTests.PRIMARY));
    Assert.areEqual(state, state.placeOn([new ScreenArea(-1920, 0, 1920, 1040), new ScreenArea(0, 0, 1920, 1040)], WindowStateTests.PRIMARY));
  }

  @TestMethod
  public dropsAPositionThatNoDisplayShows(): void {
    const placed = new WindowState(4000, 100, 1000, 700, true).placeOn([new ScreenArea(0, 0, 1920, 1040)], WindowStateTests.PRIMARY);

    Assert.isNull(placed.x);
    Assert.isNull(placed.y);
    Assert.areEqual(1000, placed.width);
    Assert.isTrue(placed.isMaximized);
    Assert.isNull(new WindowState(0, 0, 1000, 700, false).placeOn([], WindowStateTests.PRIMARY).x);
  }

  @TestMethod
  public leavesAStateWithoutAPositionAsItIs(): void {
    const state = WindowState.createDefault(WindowStateTests.PRIMARY);

    Assert.areEqual(state, state.placeOn([], WindowStateTests.PRIMARY));
  }

  @TestMethod
  public keepsASavedSizeThatFitsItsDisplayEvenAboveNineTenths(): void {
    const state = new WindowState(10, 30, 1000, 700, true);

    Assert.areEqual(state, state.placeOn([new ScreenArea(0, 25, 1024, 743)], new ScreenArea(0, 25, 1024, 743)));
  }

  @TestMethod
  public shrinksASavedSizeLargerThanItsDisplayAndCentresItThere(): void {
    const small = new ScreenArea(1920, 25, 1024, 743);
    const placed = new WindowState(1900, 30, 1280, 800, true).placeOn([new ScreenArea(0, 0, 1920, 1040), small], WindowStateTests.PRIMARY);

    Assert.areEqual("1971,62,921,668,true", [placed.x, placed.y, placed.width, placed.height, placed.isMaximized].join(","));
  }

  @TestMethod
  public keepsASideAlreadyWithinNineTenthsWhenItShrinks(): void {
    const placed = new WindowState(0, 25, 900, 800, false).placeOn([new ScreenArea(0, 25, 1024, 743)], WindowStateTests.PRIMARY);

    Assert.areEqual("62,62,900,668", [placed.x, placed.y, placed.width, placed.height].join(","));
  }

  @TestMethod
  public shrinksASizeWithoutAPositionToThePrimaryDisplay(): void {
    const primary = new ScreenArea(0, 25, 1024, 743);
    const unplaced = new WindowState(null, null, 1280, 800, false).placeOn([primary], primary);
    const lost = new WindowState(4000, 100, 1280, 800, true).placeOn([primary], primary);

    Assert.areEqual(",,921,668,false", [unplaced.x, unplaced.y, unplaced.width, unplaced.height, unplaced.isMaximized].join(","));
    Assert.areEqual(",,921,668,true", [lost.x, lost.y, lost.width, lost.height, lost.isMaximized].join(","));
  }
}
