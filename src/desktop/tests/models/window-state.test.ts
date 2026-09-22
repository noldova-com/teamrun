/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Resources, WindowState } from "@noldova/teamrun-desktop";

@TestClass
export class WindowStateTests {
  @TestMethod
  public roundTripsAndReadsLeniently(): void {
    const state = new WindowState(10, 20, 1600.4, 900, true);

    Assert.areEqual(JSON.stringify({ x: 10, y: 20, width: 1600, height: 900, maximized: true }), JSON.stringify(state.toJson()));
    Assert.areEqual(1600, WindowState.fromJson(state.toJson()).width);
    Assert.isTrue(WindowState.fromJson(state.toJson()).maximized);

    const defaults = WindowState.createDefault();
    Assert.isNull(defaults.x);
    Assert.areEqual(Resources.windowWidth, defaults.width);
    Assert.isFalse(defaults.maximized);
    Assert.areEqual(Resources.windowHeight, WindowState.fromJson("nope").height);
    Assert.areEqual(Resources.windowHeight, WindowState.fromJson([1]).height);
    Assert.areEqual(Resources.windowWidth, WindowState.fromJson({ width: "wide", maximized: "yes" }).width);
    Assert.isFalse(WindowState.fromJson({ width: "wide", maximized: "yes" }).maximized);
    Assert.isNull(WindowState.fromJson({ x: 5 }).x);
    Assert.isNull(WindowState.fromJson({ x: 5, y: null }).x);
    Assert.areEqual(5, WindowState.fromJson({ x: 5, y: 6 }).x);
    Assert.areEqual(Resources.windowMinimumWidth, new WindowState(null, null, 10, 10, false).width);
    Assert.areEqual(Resources.windowMinimumHeight, new WindowState(null, null, 10, 10, false).height);
  }
}
