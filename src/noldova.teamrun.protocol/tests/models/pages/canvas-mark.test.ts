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
import { CanvasMark, CanvasMarkKind, PageAuthor } from "@noldova/teamrun.protocol";

@TestClass
export class CanvasMarkTests {
  private static readonly author: object = { teammateId: "t1", name: "Opus" };
  private static readonly sol: PageAuthor = new PageAuthor(null, "Sol");

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { id: "m1", canvasPage: "cp2", kind: "Arrow", geometry: [0, 0, 120.5, 40], colour: "#d33", weight: 2, fill: null, text: null, group: "g1",
      locked: true, hidden: false, author: CanvasMarkTests.author };

    const mark = CanvasMark.fromJson(json);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(mark.toJson()));
    Assert.areEqual(CanvasMarkKind.Arrow, mark.kind);
  }

  @TestMethod
  public rejectsAMarkWithBadPointsOrStyle(): void {
    const make = (kind: CanvasMarkKind, geometry: readonly number[], weight: number, text: string | null): CanvasMark =>
      new CanvasMark("m1", "cp1", kind, geometry, "#000", weight, null, text, null, false, false, CanvasMarkTests.sol);

    Assert.throws(() => make(CanvasMarkKind.Line, [], 1, null), ArgumentOutOfRangeException);
    Assert.throws(() => make(CanvasMarkKind.Line, [0, 0, 1], 1, null), ArgumentOutOfRangeException);
    Assert.throws(() => make(CanvasMarkKind.Line, [0, Number.NaN], 1, null), ArgumentOutOfRangeException);
    Assert.throws(() => make(CanvasMarkKind.Line, [0, 0], 0, null), ArgumentOutOfRangeException);
    Assert.throws(() => make(CanvasMarkKind.Text, [0, 0], 1, null), ArgumentException);
    Assert.throws(() => new CanvasMark("m1", "cp1", CanvasMarkKind.Oval, [0, 0], "#000", 1, " ", null, null, false, false, CanvasMarkTests.sol),
      ArgumentException);
    Assert.areEqual("Hi", make(CanvasMarkKind.Text, [0, 0], 1, "Hi").text);
  }

  @TestMethod
  public rejectsAnUnknownKindWithItsPath(): void {
    const json = { id: "m1", canvasPage: "cp1", kind: "Star", geometry: [0, 0], colour: "#000", weight: 1, fill: null, text: null, group: null,
      locked: false, hidden: false, author: CanvasMarkTests.author };

    Assert.areEqual("$.kind", Assert.throws(() => CanvasMark.fromJson(json), JsonException).path);
  }

  @TestMethod
  public rejectsAnUnknownKindInTheConstructor(): void {
    Assert.throws(() => new CanvasMark("m1", "cp1", "Star" as CanvasMarkKind, [0, 0], "#000", 1, null, null, null, false, false, CanvasMarkTests.sol),
      ArgumentOutOfRangeException);
  }

  @TestMethod
  public takesAnIdOf120CharactersAndRefusesLonger(): void {
    const make = (id: string): CanvasMark =>
      new CanvasMark(id, "cp1", CanvasMarkKind.Line, [0, 0], "#000", 1, null, null, null, false, false, CanvasMarkTests.sol);

    Assert.areEqual(120, make("x".repeat(120)).id.length);
    Assert.throws(() => make("x".repeat(121)), ArgumentOutOfRangeException);
  }
}
