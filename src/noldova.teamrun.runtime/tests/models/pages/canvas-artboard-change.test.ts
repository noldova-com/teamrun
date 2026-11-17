/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";

@TestClass
export class CanvasArtboardChangeTests {
  @TestMethod
  public async changesOnlyTheFieldsItNamesAndKeepsTheRest(): Promise<void> {
    using pages = new PagesHarness();
    const { id, artboard } = await CanvasArtboardChangeTests.artboardAsync(pages);

    const moved = await CanvasArtboardChangeTests.arrangeAsync(pages, id, 2, { id: artboard, x: 5, height: 600 });
    const styled = await CanvasArtboardChangeTests.arrangeAsync(pages, id, 3, { id: artboard, y: 7, width: 390, title: "B", locked: true, hidden: true,
      group: "g" });

    Assert.areEqual("5,0,1280,600 A false false null", CanvasArtboardChangeTests.describe(moved));
    Assert.areEqual("5,7,390,600 B true true g", CanvasArtboardChangeTests.describe(styled));
  }

  @TestMethod
  public async keepsAGroupLeftOutClearsANullOneAndRemovesTheArtboard(): Promise<void> {
    using pages = new PagesHarness();
    const { id, artboard } = await CanvasArtboardChangeTests.artboardAsync(pages);
    await CanvasArtboardChangeTests.arrangeAsync(pages, id, 2, { id: artboard, group: "g" });

    const kept = await CanvasArtboardChangeTests.arrangeAsync(pages, id, 3, { id: artboard, x: 1 });
    const cleared = await CanvasArtboardChangeTests.arrangeAsync(pages, id, 4, { id: artboard, group: null });
    const removed = (await pages.callAsync("teamrun_canvas_arrange", { canvas_id: id, base_version: 5, artboards: [{ id: artboard, remove: true }] }))
      .readObject("manifest").readObjectArray("artboards");

    Assert.areEqual("g", kept.readNullableString("group"));
    Assert.isNull(cleared.readNullableString("group"));
    Assert.areEqual(0, removed.length);
  }

  private static async artboardAsync(pages: PagesHarness): Promise<{ id: string; artboard: string }> {
    pages.file("a.html", "<p>a</p>");
    const id = (await pages.callAsync("teamrun_canvas_create", { title: "Options" })).readObject("canvas").readNonBlankString("id");
    const artboard = (await pages.callAsync("teamrun_canvas_add_artboard", { canvas_id: id, base_version: 1, path: "a.html", title: "A" }))
      .readObject("artboard").readNonBlankString("id");
    return { id, artboard };
  }

  private static async arrangeAsync(pages: PagesHarness, id: string, baseVersion: number, change: Record<string, string | number | boolean | null>):
    Promise<JsonReader> {
    const artboards = (await pages.callAsync("teamrun_canvas_arrange", { canvas_id: id, base_version: baseVersion, artboards: [change] }))
      .readObject("manifest").readObjectArray("artboards");
    const artboard = artboards[0];
    Assert.areEqual(1, artboards.length);
    Assert.isDefined(artboard);
    return artboard;
  }

  private static describe(artboard: JsonReader): string {
    return `${["x", "y", "width", "height"].map(t => String(artboard.readNumber(t))).join()} ${artboard.readString("title")} `
      + `${String(artboard.readBoolean("locked"))} ${String(artboard.readBoolean("hidden"))} ${String(artboard.readNullableString("group"))}`;
  }
}
