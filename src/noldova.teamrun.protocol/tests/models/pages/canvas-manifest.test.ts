/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  CanvasArtboard, CanvasAxis, CanvasGuide, CanvasManifest, CanvasMark, CanvasMarkKind, CanvasNote, CanvasNoteKind, CanvasPage, PageAuthor
} from "@noldova/teamrun.protocol";

@TestClass
export class CanvasManifestTests {
  private static readonly author: object = { teammateId: "t1", name: "Opus" };

  private static readonly json: object = {
    pages: [{ id: "cp1", name: "Options" }, { id: "cp2", name: "Flows" }],
    artboards: [{
      id: "a1", pageId: "p1", pageVersion: 2, canvasPage: "cp1", x: -40, y: 0, width: 1280, height: 800, title: "Home", locked: false, hidden: false,
      group: null
    }],
    notes: [{
      id: "n1", canvasPage: "cp1", x: 0, y: -120, width: 320, kind: "Link", text: "Spec", href: "https://example.com/spec", author: CanvasManifestTests.author,
      at: "2026-11-13T09:00:00.000Z"
    }],
    marks: [{
      id: "m1", canvasPage: "cp2", kind: "Arrow", geometry: [0, 0, 120.5, 40], colour: "#d33", weight: 2, fill: null, text: null, group: "g1",
      locked: true, hidden: false, author: CanvasManifestTests.author
    }],
    guides: [{ canvasPage: "cp2", axis: "Vertical", at: 640 }]
  };

  private static readonly sol: PageAuthor = new PageAuthor(null, "Sol");

  @TestMethod
  public roundTripsThroughJson(): void {
    const manifest = CanvasManifest.fromJson(CanvasManifestTests.json);

    Assert.areEqual(JSON.stringify(CanvasManifestTests.json), JSON.stringify(manifest.toJson()));
    Assert.areEqual(CanvasNoteKind.Link, manifest.notes[0]?.kind);
    Assert.areEqual(CanvasMarkKind.Arrow, manifest.marks[0]?.kind);
    Assert.areEqual(CanvasAxis.Vertical, manifest.guides[0]?.axis);
    Assert.areEqual(2, manifest.artboards[0]?.pageVersion);
  }

  @TestMethod
  public rejectsAManifestWithNoPages(): void {
    Assert.throws(() => new CanvasManifest([], [], [], [], []), ArgumentException);
  }

  @TestMethod
  public rejectsTwoItemsWithOneId(): void {
    const page = new CanvasPage("cp1", "Options");

    Assert.throws(() => new CanvasManifest([page, new CanvasPage("cp1", "Again")], [], [], [], []), ArgumentException);
    Assert.throws(() => new CanvasManifest([page], [CanvasManifestTests.artboard("cp1")], [], [], []), ArgumentException);
    Assert.throws(() => new CanvasManifest([page], [CanvasManifestTests.artboard("a1"), CanvasManifestTests.artboard("a1")], [], [], []), ArgumentException);
  }

  @TestMethod
  public rejectsAnItemOnAPageTheCanvasDoesNotHave(): void {
    const pages = [new CanvasPage("cp1", "Options")];
    const note = new CanvasNote("n1", "cp9", 0, 0, 100, CanvasNoteKind.Sticky, "Hi", null, CanvasManifestTests.sol, "t0");
    const mark = new CanvasMark("m1", "cp9", CanvasMarkKind.Line, [0, 0, 1, 1], "#000", 1, null, null, null, false, false, CanvasManifestTests.sol);

    Assert.throws(() => new CanvasManifest(pages, [CanvasManifestTests.artboard("a1", "cp9")], [], [], []), ArgumentException);
    Assert.throws(() => new CanvasManifest(pages, [], [note], [], []), ArgumentException);
    Assert.throws(() => new CanvasManifest(pages, [], [], [mark], []), ArgumentException);
    Assert.throws(() => new CanvasManifest(pages, [], [], [], [new CanvasGuide("cp9", CanvasAxis.Horizontal, 0)]), ArgumentException);
  }

  @TestMethod
  public rejectsAPageWithoutANameWithItsPath(): void {
    const pages = Assert.throws(() => CanvasManifest.fromJson({ ...CanvasManifestTests.json, pages: [{ id: "cp1" }] }), JsonException);

    Assert.areEqual("$.pages.0.name", pages.path);
  }

  private static artboard(id: string, canvasPage: string = "cp1"): CanvasArtboard {
    return new CanvasArtboard(id, "p1", 1, canvasPage, 0, 0, 1280, 800, "Home", false, false, null);
  }

}
