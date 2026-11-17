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
import { CanvasNote, CanvasNoteKind, PageAuthor } from "@noldova/teamrun.protocol";

@TestClass
export class CanvasNoteTests {
  private static readonly author: object = { teammateId: "t1", name: "Opus" };
  private static readonly sol: PageAuthor = new PageAuthor(null, "Sol");

  @TestMethod
  public roundTripsThroughJson(): void {
    const json = { id: "n1", canvasPage: "cp1", x: 0, y: -120, width: 320, kind: "Link", text: "Spec", href: "https://example.com/spec",
      author: CanvasNoteTests.author, at: "2026-11-13T09:00:00.000Z" };

    const note = CanvasNote.fromJson(json);

    Assert.areEqual(JSON.stringify(json), JSON.stringify(note.toJson()));
    Assert.areEqual(CanvasNoteKind.Link, note.kind);
  }

  @TestMethod
  public rejectsALinkWithoutAnAddress(): void {
    Assert.throws(() => new CanvasNote("n1", "cp1", 0, 0, 100, CanvasNoteKind.Link, "Spec", null, CanvasNoteTests.sol, "t0"), ArgumentException);
    Assert.throws(() => new CanvasNote("n1", "cp1", 0, 0, 100, CanvasNoteKind.Sticky, "Hi", " ", CanvasNoteTests.sol, "t0"), ArgumentException);
    Assert.throws(() => new CanvasNote("n1", "cp1", 0, 0, 0, CanvasNoteKind.Sticky, "Hi", null, CanvasNoteTests.sol, "t0"), ArgumentOutOfRangeException);
    Assert.throws(() => new CanvasNote("n1", "cp1", 0, 0, 100, CanvasNoteKind.Title, " ", null, CanvasNoteTests.sol, "t0"), ArgumentException);
  }

  @TestMethod
  public rejectsAnUnknownKindWithItsPath(): void {
    const json = { id: "n1", canvasPage: "cp1", x: 0, y: 0, width: 100, kind: "comment", text: "Hi", href: null, author: CanvasNoteTests.author, at: "t0" };

    Assert.areEqual("$.kind", Assert.throws(() => CanvasNote.fromJson(json), JsonException).path);
  }

  @TestMethod
  public rejectsAnUnknownKindInTheConstructor(): void {
    Assert.throws(() => new CanvasNote("n1", "cp1", 0, 0, 100, "comment" as CanvasNoteKind, "Hi", null, CanvasNoteTests.sol, "t0"),
      ArgumentOutOfRangeException);
  }

  @TestMethod
  public takesAnIdOf120CharactersAndRefusesLonger(): void {
    const make = (id: string): CanvasNote => new CanvasNote(id, "cp1", 0, 0, 100, CanvasNoteKind.Sticky, "Hi", null, CanvasNoteTests.sol, "t0");

    Assert.areEqual(120, make("x".repeat(120)).id.length);
    Assert.throws(() => make("x".repeat(121)), ArgumentOutOfRangeException);
  }
}
