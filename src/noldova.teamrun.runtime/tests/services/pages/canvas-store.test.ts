/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";

@TestClass
export class CanvasStoreTests {
  private static readonly create: string = "teamrun_canvas_create";
  private static readonly read: string = "teamrun_canvas_read";
  private static readonly add: string = "teamrun_canvas_add_artboard";
  private static readonly revise: string = "teamrun_canvas_revise_artboard";
  private static readonly arrange: string = "teamrun_canvas_arrange";
  private static readonly MAXIMUM_PAGE: number = 5 * 1024 * 1024;
  private static readonly CANVAS_TOO_LARGE: string = "TooLarge The canvas's artboards would be over 50 MB together. Keep them smaller, or make another canvas.";
  private static readonly STALE: string = "Stale The canvas has changed since that version. Read its current version and change that.";

  @TestMethod
  public async makesOnePageWhenNoneAreNamedTakes40AndRefusesMore(): Promise<void> {
    using pages = new PagesHarness();

    const canvas = await pages.callAsync(CanvasStoreTests.create, { title: "Options" });
    const names = Array.from({ length: 41 }, (_, i) => `P${String(i)}`);
    const refused = await pages.failureAsync(CanvasStoreTests.create, { title: "Many", pages: names });
    const arranged = await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: canvas.readObject("canvas").readString("id"), base_version: 1,
      pages: names.map(t => ({ name: t })) });

    Assert.areEqual("Page 1", canvas.readObject("manifest").readObjectArray("pages").map(t => t.readString("name")).join());
    Assert.areEqual("Refused A canvas has at most 40 pages.", refused);
    Assert.areEqual("Refused A canvas has at most 40 pages.", arranged);
    const most = await pages.callAsync(CanvasStoreTests.create, { title: "Most", pages: names.slice(1) });
    const arrangedMost = await pages.callAsync(CanvasStoreTests.arrange, { canvas_id: canvas.readObject("canvas").readString("id"), base_version: 1,
      pages: names.slice(1).map(t => ({ name: t })) });
    Assert.areEqual(40, most.readObject("manifest").readObjectArray("pages").length);
    Assert.areEqual("2 40", `${String(arrangedMost.readInteger("version"))} ${String(arrangedMost.readObject("manifest").readObjectArray("pages").length)}`);
  }

  @TestMethod
  public async refusesTheTwoHundredAndFirstArtboard(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasStoreTests.canvasAsync(pages);
    const manifest = (await pages.callAsync(CanvasStoreTests.read, { canvas_id: id })).readObject("manifest");
    const canvasPage = manifest.readObjectArray("pages")[0]?.readString("id") ?? String.empty;
    const artboards = Array.from({ length: 200 }, (_, i) => ({ id: `a${String(i)}`, pageId: `p${String(i)}`, pageVersion: 1, canvasPage, x: 0, y: 0,
      width: 1, height: 1, title: "A", locked: false, hidden: false, group: null }));
    pages.database.run("UPDATE pageVersions SET html = ? WHERE pageId = ? AND version = 1", JSON.stringify({
      pages: manifest.readObjectArray("pages").map(t => t.toJson()), artboards, notes: [], marks: [], guides: []
    }), id);

    const seeded = await pages.callAsync(CanvasStoreTests.read, { canvas_id: id });
    const refused = await pages.failureAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" });

    Assert.areEqual(200, seeded.readObject("manifest").readObjectArray("artboards").length);
    Assert.areEqual("Refused The canvas has 200 artboards, its most. Make another canvas for more.", refused);
    Assert.areEqual(0, (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages").length);
  }

  @TestMethod
  public async refusesArtboardsOver50MegabytesTogetherFromEachWayInAndTakesExactly50(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("small.html", "b");
    pages.file("big.html", "a".repeat(CanvasStoreTests.MAXIMUM_PAGE));
    pages.file("almost.html", "a".repeat(CanvasStoreTests.MAXIMUM_PAGE - 1));
    const id = await CanvasStoreTests.canvasAsync(pages);
    const paths = ["small.html", ...Array.from({ length: 9 }, () => "big.html"), "almost.html"];
    for (const [index, path] of paths.entries())
      await pages.callAsync(CanvasStoreTests.add, { canvas_id: id, base_version: index + 1, path, title: "Big" });

    const artboard = (await pages.callAsync(CanvasStoreTests.read, { canvas_id: id })).readObject("manifest").readObjectArray("artboards")[0]
      ?.readString("id") ?? String.empty;
    const revise = { canvas_id: id, base_version: 12, artboard_id: artboard };

    const refused = [
      await pages.failureAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 12, path: "small.html", title: "Small" }),
      await pages.failureAsync(CanvasStoreTests.revise, { ...revise, html: "a".repeat(CanvasStoreTests.MAXIMUM_PAGE) }),
      await pages.failureAsync(CanvasStoreTests.revise, { ...revise, edits: [{ find: "b", replace: "a".repeat(CanvasStoreTests.MAXIMUM_PAGE) }] }),
      await pages.failureAsync(CanvasStoreTests.revise, { ...revise, path: "big.html" })
    ];

    const atTheLimit = await pages.callAsync(CanvasStoreTests.revise, { ...revise, html: "c" });

    Assert.areEqual(Array.from({ length: 4 }, () => CanvasStoreTests.CANVAS_TOO_LARGE).join("|"), refused.join("|"));
    Assert.areEqual("13 2", `${String(atTheLimit.readObject("canvas").readInteger("version"))} ${String(atTheLimit.readObject("page").readInteger("version"))}`);
    const read = await pages.callAsync(CanvasStoreTests.read, { canvas_id: id });
    Assert.areEqual("13 11", `${String(read.readInteger("version"))} ${String(read.readObject("manifest").readObjectArray("artboards").length)}`);
  }

  @TestMethod
  public async keepsTheLast50VersionsOfACanvas(): Promise<void> {
    using pages = new PagesHarness();
    const id = await CanvasStoreTests.canvasAsync(pages);
    for (let version = 1; version <= 50; version++)
      await pages.callAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: version, pages: [{ name: `P${String(version)}` }] });

    const refused = await pages.failureAsync(CanvasStoreTests.read, { canvas_id: id, version: 1 });
    const kept = await pages.callAsync(CanvasStoreTests.read, { canvas_id: id, version: 2 });

    Assert.areEqual("Refused The canvas has no such version. Only its last 50 versions are kept.", refused);
    Assert.areEqual("P1", kept.readObject("manifest").readObjectArray("pages").map(t => t.readString("name")).join());
  }

  @TestMethod
  public async refusesAnArtboardWithoutAWidthOrHeightAboveZeroWhenAddedOrArranged(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasStoreTests.canvasAsync(pages);
    const artboard = (await pages.callAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" })).readObject("artboard")
      .readString("id");

    const refused = [
      await pages.failureAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 2, path: "a.html", title: "B", width: 0 }),
      await pages.failureAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 2, path: "a.html", title: "B", height: -1 }),
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: artboard, width: 0 }] }),
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: artboard, height: -1 }] })
    ];

    Assert.areEqual("Refused,Refused,Refused,Refused", refused.map(t => t.split(" ")[0]).join());
    Assert.areEqual(2, (await pages.callAsync(CanvasStoreTests.read, { canvas_id: id })).readInteger("version"));
    Assert.areEqual(2, pages.database.readAll("SELECT id FROM pages").length);
  }

  @TestMethod
  public async takesNamesIdsAndGroupsOf120CharactersAndRefusesLonger(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const at = "x".repeat(120);
    const over = "x".repeat(121);
    const id = await CanvasStoreTests.canvasAsync(pages);
    const added = (await pages.callAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" })).readObject("artboard");
    const artboard = added.readString("id");
    const first = { id: added.readString("canvasPage"), name: "Page 1" };

    const refused = [
      await pages.failureAsync(CanvasStoreTests.create, { title: "Long", pages: [over] }),
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, pages: [first, { name: over }] }),
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, pages: [first, { id: over, name: "P" }] }),
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: artboard, group: over }] })
    ];
    const taken = await pages.callAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: artboard, canvas_page: at, group: at }],
      pages: [{ id: at, name: at }] });

    Assert.areEqual("Refused,Refused,Refused,Refused", refused.map(t => t.split(" ")[0]).join());
    Assert.areEqual(["name", "name", "id", "group"].map(t => `Refused The argument must be within the valid range. (Parameter '${t}')`).join("|"),
      refused.join("|"));
    const manifest = taken.readObject("manifest");
    Assert.areEqual(`${at} ${at} ${at} ${at}`, [manifest.readObjectArray("pages")[0]?.readString("id"), manifest.readObjectArray("pages")[0]?.readString("name"),
      manifest.readObjectArray("artboards")[0]?.readString("canvasPage"), manifest.readObjectArray("artboards")[0]?.readNullableString("group")].join(" "));
    Assert.areEqual(at, (await pages.callAsync(CanvasStoreTests.create, { title: "Long", pages: [at] })).readObject("manifest").readObjectArray("pages")[0]
      ?.readString("name"));
  }

  @TestMethod
  public async refusesAnArrangementThatLeavesOutAnArtboardsPageOrMovesItToAnUnknownOne(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasStoreTests.canvasAsync(pages);
    const added = (await pages.callAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" })).readObject("artboard");
    const artboard = added.readString("id");

    const refused = [
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, pages: [{ name: "Other" }] }),
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: artboard, canvas_page: "missing" }] }),
      await pages.failureAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: artboard, canvas_page: "missing" }],
        pages: [{ name: "Other" }] })
    ];
    const moved = await pages.callAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: artboard, canvas_page: "next" }],
      pages: [{ id: "next", name: "Next" }] });

    Assert.areEqual([
      "Refused A canvas page that still has artboards, notes, marks or guides can't be left out. Move or remove them first, or keep the page.",
      "Refused The canvas has no page with that id. Read the canvas to find its pages.",
      "Refused The canvas has no page with that id. Read the canvas to find its pages."
    ].join("|"), refused.join("|"));
    const placed = moved.readObject("manifest").readObjectArray("artboards")[0]?.readString("canvasPage");
    Assert.areEqual("3 next", `${String(moved.readInteger("version"))} ${placed ?? String.empty}`);
  }

  @TestMethod
  public async keepsNeitherTheArtboardsPageVersionNorItsCopyWhenTheCanvasVersionCantBeWritten(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasStoreTests.canvasAsync(pages);
    const added = await pages.callAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" });
    const page = added.readObject("page").readString("id");
    pages.database.run(`CREATE TRIGGER failCanvas BEFORE INSERT ON pageVersions WHEN NEW.pageId = '${id}' BEGIN SELECT RAISE(ABORT, 'The disk is full.'); END`);

    const failed = await pages.failureAsync(CanvasStoreTests.revise, { canvas_id: id, base_version: 2, artboard_id: added.readObject("artboard").readString("id"),
      html: "<p>b</p>" });

    Assert.areEqual("OutcomeUncertain", failed.split(" ")[0]);
    Assert.areEqual("<p>a</p>", readFileSync(pages.copyOf("c1", page), "utf8"));
    const read = await pages.callAsync(PagesHarness.read, { page_id: page });
    Assert.areEqual("1 <p>a</p>", `${String(read.readInteger("version"))} ${read.readString("html")}`);
    Assert.areEqual(2, (await pages.callAsync(CanvasStoreTests.read, { canvas_id: id })).readInteger("version"));
  }

  @TestMethod
  public async takesOneOfTwoArtboardsAddedFromTheSameVersionAtOnceAndRefusesTheOtherStale(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasStoreTests.canvasAsync(pages);
    const input = { canvas_id: id, base_version: 1, path: "a.html", title: "A" };

    const outcomes = await Promise.all([pages.outcomeAsync(CanvasStoreTests.add, input), pages.outcomeAsync(CanvasStoreTests.add, input, "Sol")]);

    Assert.areEqual(`Taken|${CanvasStoreTests.STALE} Its current version is 2.`, outcomes.join("|"));
    const read = await pages.callAsync(CanvasStoreTests.read, { canvas_id: id });
    Assert.areEqual("2 1", `${String(read.readInteger("version"))} ${String(read.readObject("manifest").readObjectArray("artboards").length)}`);
    Assert.areEqual(2, pages.database.readAll("SELECT id FROM pages").length);
  }

  @TestMethod
  public async takesOneOfTwoArtboardRevisionsFromTheSameVersionAtOnceAndRefusesTheOtherStale(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasStoreTests.canvasAsync(pages);
    const added = await pages.callAsync(CanvasStoreTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" });
    const revise = { canvas_id: id, base_version: 2, artboard_id: added.readObject("artboard").readString("id") };

    const outcomes = await Promise.all([pages.outcomeAsync(CanvasStoreTests.revise, { ...revise, html: "<p>b</p>" }),
      pages.outcomeAsync(CanvasStoreTests.revise, { ...revise, html: "<p>c</p>" }, "Sol")]);

    Assert.areEqual(`Taken|${CanvasStoreTests.STALE} Its current version is 3.`, outcomes.join("|"));
    const read = await pages.callAsync(PagesHarness.read, { page_id: added.readObject("page").readString("id") });
    Assert.areEqual("2 <p>b</p>", `${String(read.readInteger("version"))} ${read.readString("html")}`);
  }

  @TestMethod
  public async takesOneOfTwoArrangementsFromTheSameVersionAtOnceAndRefusesTheOtherStale(): Promise<void> {
    using pages = new PagesHarness();
    const id = await CanvasStoreTests.canvasAsync(pages);

    const outcomes = await Promise.all([pages.outcomeAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 1, pages: [{ name: "First" }] }),
      pages.outcomeAsync(CanvasStoreTests.arrange, { canvas_id: id, base_version: 1, pages: [{ name: "Second" }] }, "Sol")]);

    Assert.areEqual(`Taken|${CanvasStoreTests.STALE} Its current version is 2.`, outcomes.join("|"));
    const read = await pages.callAsync(CanvasStoreTests.read, { canvas_id: id });
    Assert.areEqual("2 First", `${String(read.readInteger("version"))} ${read.readObject("manifest").readObjectArray("pages").map(t => t.readString("name")).join()}`);
  }

  private static async canvasAsync(pages: PagesHarness): Promise<string> {
    return (await pages.callAsync(CanvasStoreTests.create, { title: "Options" })).readObject("canvas").readNonBlankString("id");
  }
}
