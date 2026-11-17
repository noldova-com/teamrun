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
import { CanvasArtboard } from "@noldova/teamrun.protocol";

@TestClass
export class CanvasArtboardTests {
  private static readonly at: string = "x".repeat(120);
  private static readonly over: string = "x".repeat(121);

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { id: "a1", pageId: "p1", pageVersion: 2, canvasPage: "cp1", x: -40, y: 0.5, width: 1280, height: 800, title: "Home", locked: true,
      hidden: false, group: "g1" };

    Assert.areEqual(JSON.stringify(json), JSON.stringify(CanvasArtboard.fromJson(json).toJson()));
  }

  @TestMethod
  public rejectsAnArtboardWithABadPlaceOrVersion(): void {
    const make = (version: number, x: number, width: number, height: number): CanvasArtboard =>
      new CanvasArtboard("a1", "p1", version, "cp1", x, 0, width, height, "Home", false, false, null);

    Assert.throws(() => make(0, 0, 1, 1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1.5, 0, 1, 1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1, Number.NaN, 1, 1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1, Number.POSITIVE_INFINITY, 1, 1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1, 0, 0, 1), ArgumentOutOfRangeException);
    Assert.throws(() => make(1, 0, 1, -1), ArgumentOutOfRangeException);
    Assert.throws(() => new CanvasArtboard("a1", "p1", 1, "cp1", 0, 0, 1, 1, " ", false, false, null), ArgumentException);
    Assert.throws(() => new CanvasArtboard("a1", "p1", 1, "cp1", 0, 0, 1, 1, "Home", false, false, " "), ArgumentException);
    Assert.areEqual(-3, make(1, -3, 1, 1).x);
  }

  @TestMethod
  public takesAnIdCanvasPageTitleAndGroupOf120CharactersAndRefusesLonger(): void {
    const make = (id: string, canvasPage: string, title: string, group: string | null): CanvasArtboard =>
      new CanvasArtboard(id, "p1", 1, canvasPage, 0, 0, 1, 1, title, false, false, group);
    const { at, over } = CanvasArtboardTests;

    Assert.throws(() => make(over, "cp1", "Home", null), ArgumentOutOfRangeException);
    Assert.throws(() => make("a1", over, "Home", null), ArgumentOutOfRangeException);
    Assert.throws(() => make("a1", "cp1", over, null), ArgumentOutOfRangeException);
    Assert.throws(() => make("a1", "cp1", "Home", over), ArgumentOutOfRangeException);
    const longest = make(at, at, at, at);
    Assert.areEqual(`${at} ${at} ${at} ${at}`, `${longest.id} ${longest.canvasPage} ${longest.title} ${String(longest.group)}`);
    Assert.areEqual("\u{1F600}".repeat(120), make("a1", "cp1", "\u{1F600}".repeat(120), null).title);
  }

  @TestMethod
  public rejectsABadFieldWithItsPath(): void {
    const error = Assert.throws(() => CanvasArtboard.fromJson({ id: "a1", pageId: "p1", pageVersion: "2", canvasPage: "cp1", x: 0, y: 0, width: 1,
      height: 1, title: "Home", locked: false, hidden: false, group: null }), JsonException);

    Assert.areEqual("$.pageVersion", error.path);
  }
}
