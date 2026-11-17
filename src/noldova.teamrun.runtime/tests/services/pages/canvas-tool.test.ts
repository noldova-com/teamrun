/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, writeFileSync } from "node:fs";

import { MethodFailureException, ToolFailureException } from "@noldova/desktop.runtime";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import "@noldova/context.core";
import type { JsonReader, JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Page, PageKind } from "@noldova/teamrun.protocol";
import { Pages } from "@noldova/teamrun.runtime";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";
import { PagesServing } from "../../fixtures/pages-serving.fixture.js";

@TestClass
export class CanvasToolTests {
  private static readonly create: string = "teamrun_canvas_create";
  private static readonly read: string = "teamrun_canvas_read";
  private static readonly add: string = "teamrun_canvas_add_artboard";
  private static readonly revise: string = "teamrun_canvas_revise_artboard";
  private static readonly arrange: string = "teamrun_canvas_arrange";
  private static readonly NOT_A_PAGE: string = "Refused That id is a canvas, not a page. Use the canvas tools, such as teamrun_canvas_read, for it.";
  private static readonly NOT_A_CANVAS: string = "Refused That id is a page, not a canvas. Use teamrun_canvas_create to make a canvas.";
  private static readonly STALE: string = "Stale The canvas has changed since that version. Read its current version and change that. Its current version is 2.";
  private static readonly ARTBOARD_PAGE: string =
    "Refused That page is an artboard of a canvas. Change it with teamrun_canvas_revise_artboard.";
  private static readonly ARTBOARD_UNKNOWN: string =
    "Refused The canvas has no artboard with that id, or one is named twice. Read the canvas to find its artboards.";

  @TestMethod
  public async makesACanvasWithItsPagesAsVersionOneWithoutACopyOnDiskAndMarksSending(): Promise<void> {
    using pages = new PagesHarness();
    const call = PagesHarness.callOf({ title: "Options", pages: ["Options", "Flows"] });

    const answer = PagesHarness.answerOf(await pages.handlerOf(CanvasToolTests.create).handleAsync(call));

    const canvas = Page.fromJson(answer.readObject("canvas").toJson());
    Assert.areEqual("Canvas 1 Options Opus", `${canvas.kind} ${String(canvas.version)} ${canvas.title} ${canvas.madeBy.name}`);
    Assert.areEqual("Options,Flows", answer.readObject("manifest").readObjectArray("pages").map(t => t.readString("name")).join());
    Assert.areEqual(0, answer.readObject("manifest").readObjectArray("artboards").length);
    Assert.isTrue(call.hasMarkedSending);
    Assert.isFalse(existsSync(pages.copyOf("c1", canvas.id)));
    const listed = await pages.callAsync(PagesHarness.list, {});
    Assert.areEqual(`0 ${canvas.id} Canvas`, `${String(listed.readObjectArray("pages").length)} `
      + listed.readObjectArray("canvases").map(t => `${t.readString("id")} ${t.readString("kind")}`).join());
  }

  @TestMethod
  public async addsArtboardsSideBySideEachAPageAndEachAVersionOfTheCanvas(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    pages.file("b.html", "<p>b</p>");
    const id = await CanvasToolTests.canvasAsync(pages);
    const call = PagesHarness.callOf({ canvas_id: id, base_version: 1, path: "a.html", title: "Home" });

    const first = PagesHarness.answerOf(await pages.handlerOf(CanvasToolTests.add).handleAsync(call));
    const second = await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 2, path: "b.html", title: "Settings", y: 40, width: 390 }, "Sol");

    Assert.isTrue(call.hasMarkedSending);
    Assert.areEqual("0,0,1280,800", CanvasToolTests.placeOf(first.readObject("artboard")));
    Assert.areEqual("1360,40,390,800", CanvasToolTests.placeOf(second.readObject("artboard")));
    Assert.areEqual("3 Sol", `${String(second.readObject("canvas").readInteger("version"))} ${second.readObject("canvas").readObject("editedBy").readString("name")}`);
    const page = second.readObject("page");
    Assert.areEqual(page.readString("id"), second.readObject("artboard").readString("pageId"));
    Assert.areEqual("Page Settings", `${page.readString("kind")} ${page.readString("title")}`);
    Assert.areEqual("<p>b</p>", (await pages.callAsync(PagesHarness.read, { page_id: page.readString("id") })).readString("html"));
    const read = await pages.callAsync(CanvasToolTests.read, { canvas_id: id });
    Assert.areEqual("3 Home,Settings", `${String(read.readInteger("version"))} ${CanvasToolTests.titlesOf(read)}`);
    Assert.areEqual(String.empty, CanvasToolTests.titlesOf(await pages.callAsync(CanvasToolTests.read, { canvas_id: id, version: 1 })));
  }

  @TestMethod
  public async revisesAnArtboardFromEditsHtmlOrAFileAsItsPagesNextVersion(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    pages.file("c.html", "<p>c</p>");
    pages.file("other.html", "<p>other</p>");
    const id = await CanvasToolTests.canvasAsync(pages);
    const artboard = (await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "Home" })).readObject("artboard")
      .readString("id");
    await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 2, path: "other.html", title: "Other" });

    const edited = await pages.callAsync(CanvasToolTests.revise, { canvas_id: id, base_version: 3, artboard_id: artboard, edits: [{ find: "a", replace: "b" }],
      title: "Start" }, "Sol");
    const written = await pages.callAsync(CanvasToolTests.revise, { canvas_id: id, base_version: 4, artboard_id: artboard, html: "<p>d</p>" });
    const shown = await pages.callAsync(CanvasToolTests.revise, { canvas_id: id, base_version: 5, artboard_id: artboard, path: "c.html" });

    const read = await pages.callAsync(CanvasToolTests.read, { canvas_id: id });
    Assert.areEqual("6 Start,Other", `${String(read.readInteger("version"))} ${CanvasToolTests.titlesOf(read)}`);
    Assert.areEqual("2 Start Sol 4", [edited.readObject("artboard").readInteger("pageVersion"), edited.readObject("artboard").readString("title"),
      edited.readObject("page").readObject("editedBy").readString("name"), edited.readObject("canvas").readInteger("version")].join(" "));
    Assert.areEqual("3 5", `${String(written.readObject("artboard").readInteger("pageVersion"))} ${String(written.readObject("canvas").readInteger("version"))}`);
    Assert.areEqual("4 Start", `${String(shown.readObject("artboard").readInteger("pageVersion"))} ${shown.readObject("page").readString("title")}`);
    const page = shown.readObject("page").readString("id");
    Assert.areEqual("<p>b</p>", (await pages.callAsync(PagesHarness.read, { page_id: page, version: 2 })).readString("html"));
    Assert.areEqual("<p>c</p>", (await pages.callAsync(PagesHarness.read, { page_id: page })).readString("html"));
  }

  @TestMethod
  public async refusesARevisionWithNoneOrMoreThanOneOfAFileHtmlAndEdits(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasToolTests.canvasAsync(pages);
    const artboard = (await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "Home" })).readObject("artboard")
      .readString("id");
    const missing = "Refused Give exactly one of path, html or edits for the artboard's new version.";

    Assert.areEqual(missing, await pages.failureAsync(CanvasToolTests.revise, { canvas_id: id, base_version: 2, artboard_id: artboard }));
    Assert.areEqual(missing, await pages.failureAsync(CanvasToolTests.revise, { canvas_id: id, base_version: 2, artboard_id: artboard, html: "x", path: "a.html" }));
    Assert.areEqual(missing, await pages.failureAsync(CanvasToolTests.revise, { canvas_id: id, base_version: 2, artboard_id: artboard, html: "x",
      edits: [{ find: "a", replace: "b" }] }));
    Assert.areEqual(CanvasToolTests.ARTBOARD_UNKNOWN, await pages.failureAsync(CanvasToolTests.revise, { canvas_id: id, base_version: 2, artboard_id: "x",
      html: "x" }));
    Assert.areEqual(2, (await pages.callAsync(CanvasToolTests.read, { canvas_id: id })).readInteger("version"));
  }

  @TestMethod
  public async arrangesArtboardsAndPagesAsTheNextVersionWithoutMarkingSendingWhenRefused(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    pages.file("b.html", "<p>b</p>");
    const id = await CanvasToolTests.canvasAsync(pages);
    const a = (await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" })).readObject("artboard");
    const b = (await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 2, path: "b.html", title: "B" })).readObject("artboard");
    const first = a.readString("canvasPage");
    const call = PagesHarness.callOf({ canvas_id: id, base_version: 3, artboards: [
      { id: a.readString("id"), x: 10, y: 20, title: "A2", locked: true, group: "g" }, { id: b.readString("id"), remove: true }
    ], pages: [{ id: first, name: "Renamed" }, { name: "Added" }] });

    const arranged = PagesHarness.answerOf(await pages.handlerOf(CanvasToolTests.arrange).handleAsync(call));
    const hidden = await pages.callAsync(CanvasToolTests.arrange, { canvas_id: id, base_version: 4, artboards: [{ id: a.readString("id"), hidden: true }] });
    const ungrouped = await pages.callAsync(CanvasToolTests.arrange, { canvas_id: id, base_version: 5, artboards: [{ id: a.readString("id"), group: null }] });
    const dropping = PagesHarness.callOf({ canvas_id: id, base_version: 6, pages: [{ name: "Only" }] });
    const refused = await Assert.throwsAsync(() => pages.handlerOf(CanvasToolTests.arrange).handleAsync(dropping), ToolFailureException);

    Assert.isTrue(call.hasMarkedSending);
    const manifest = arranged.readObject("manifest");
    Assert.areEqual("4 Renamed,Added", `${String(arranged.readInteger("version"))} ${manifest.readObjectArray("pages").map(t => t.readString("name")).join()}`);
    const artboards = manifest.readObjectArray("artboards");
    Assert.areEqual("A2 10,20,1280,800 true g", artboards.map(t => `${t.readString("title")} ${CanvasToolTests.placeOf(t)} ${String(t.readBoolean("locked"))} `
      + `${String(t.readNullableString("group"))}`).join());
    Assert.areEqual("true g", hidden.readObject("manifest").readObjectArray("artboards").map(t => `${String(t.readBoolean("hidden"))} `
      + `${String(t.readNullableString("group"))}`).join());
    Assert.areEqual("null", String(ungrouped.readObject("manifest").readObjectArray("artboards")[0]?.readNullableString("group")));
    Assert.areEqual("Refused", refused.failure.code);
    Assert.areEqual("A canvas page that still has artboards, notes, marks or guides can't be left out. Move or remove them first, or keep the page.",
      refused.failure.message);
    Assert.isFalse(dropping.hasMarkedSending);
    Assert.areEqual(6, (await pages.callAsync(CanvasToolTests.read, { canvas_id: id })).readInteger("version"));
  }

  @TestMethod
  public async refusesAStaleBaseVersionAnUnknownCanvasPageOrArtboardAndAFileOutsideTheFolderWithoutMarkingSending(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasToolTests.canvasAsync(pages);
    await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" });
    writeFileSync(pages.directory.resolve("outside.html"), "<p>o</p>");
    const staleInput = { canvas_id: id, base_version: 1, path: "a.html", title: "B" };
    const stale = PagesHarness.callOf(staleInput);

    await Assert.throwsAsync(() => pages.handlerOf(CanvasToolTests.add).handleAsync(stale), ToolFailureException);
    const failures = [
      await pages.failureAsync(CanvasToolTests.add, { canvas_id: id, base_version: 2, path: "a.html", title: "B", canvas_page: "nope" }),
      await pages.failureAsync(CanvasToolTests.add, { canvas_id: id, base_version: 2, path: "../outside.html", title: "B" }),
      await pages.failureAsync(CanvasToolTests.arrange, { canvas_id: id, base_version: 2, artboards: [{ id: "nope", x: 1 }] }),
      await pages.failureAsync(CanvasToolTests.read, { canvas_id: "nope" })
    ];

    Assert.areEqual(CanvasToolTests.STALE, await pages.failureAsync(CanvasToolTests.add, staleInput));
    Assert.isFalse(stale.hasMarkedSending);
    Assert.areEqual(["Refused The canvas has no page with that id. Read the canvas to find its pages.",
      "Refused The file isn't in this chat's folder. Write the page in the chat's folder and show it from there.", CanvasToolTests.ARTBOARD_UNKNOWN,
      "Refused This chat has no canvas with that id. List the chat's pages to find its canvases."].join("|"), failures.join("|"));
    Assert.areEqual(0, (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages").length);
  }

  @TestMethod
  public async refusesACanvasIdInThePageToolsAndAPageIdInTheCanvasTools(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await CanvasToolTests.canvasAsync(pages);
    const page = await pages.showAsync();

    const failures = [
      await pages.failureAsync(PagesHarness.read, { page_id: id }),
      await pages.failureAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "<p>b</p>" }),
      await pages.failureAsync(PagesHarness.show, { path: "a.html", title: "A", page_id: id, base_version: 1 }),
      await pages.failureAsync(CanvasToolTests.read, { canvas_id: page }),
      await pages.failureAsync(CanvasToolTests.add, { canvas_id: page, base_version: 1, path: "a.html", title: "A" })
    ];

    Assert.areEqual([CanvasToolTests.NOT_A_PAGE, CanvasToolTests.NOT_A_PAGE, CanvasToolTests.NOT_A_PAGE, CanvasToolTests.NOT_A_CANVAS,
      CanvasToolTests.NOT_A_CANVAS].join("|"), failures.join("|"));
  }

  @TestMethod
  public async answersNotFoundForACanvasInThePageMethodsRefusesRestoringAnArtboardAndSendsItsEvents(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const serving = new PagesServing();
    await pages.pages.serveAsync(serving, new ManualTimer());
    try {
      const id = await CanvasToolTests.canvasAsync(pages);
      const artboardPage = (await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" })).readObject("page")
        .readString("id");
      const restoring = await Assert.throwsAsync(() => serving.callAsync("teamrun.pageRestore", { pageId: artboardPage, version: 1 }), MethodFailureException);
      const codeOf = async (method: string): Promise<string> =>
        (await Assert.throwsAsync(() => serving.callAsync(method, { pageId: id, version: 1 }), MethodFailureException)).failure.code;

      Assert.areEqual("NotFound,NotFound,NotFound", [await codeOf("teamrun.pageOpen"), await codeOf("teamrun.pageRead"), await codeOf("teamrun.pageRestore")].join());
      Assert.areEqual(`NotFound ${CanvasToolTests.ARTBOARD_PAGE.slice("Refused ".length)}`, `${restoring.failure.code} ${restoring.failure.message}`);
      Assert.areEqual(1, (await pages.callAsync(PagesHarness.read, { page_id: artboardPage })).readInteger("version"));
      Assert.areEqual("Canvas:1", serving.publishedOf("teamrun.pageShown").map(t => `${Page.fromJson(t).kind}:${String(Page.fromJson(t).version)}`).join());
      Assert.areEqual("Canvas:2", serving.publishedOf("teamrun.pageUpdated").map(t => `${Page.fromJson(t).kind}:${String(Page.fromJson(t).version)}`).join());
    }
    finally {
      await pages.pages.closeAsync();
    }
  }

  @TestMethod
  public async leavesACanvasAndItsArtboardsOutOfTheChatsPagesAndThePageToolsUntilAnArtboardIsRemoved(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    pages.file("b.html", "<p>b</p>");
    const serving = new PagesServing();
    await pages.pages.serveAsync(serving, new ManualTimer());
    try {
      const page = await pages.showAsync();
      const id = await CanvasToolTests.canvasAsync(pages);
      const first = (await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 1, path: "a.html", title: "A" })).readObject("artboard");
      await pages.callAsync(CanvasToolTests.add, { canvas_id: id, base_version: 2, path: "b.html", title: "B" });
      const pageIdsOf = async (): Promise<string> => [
        (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages").map(t => t.readString("id")).join(),
        (await pages.callAsync(PagesHarness.list, {})).readObjectArray("canvases").map(t => t.readString("id")).join(),
        CanvasToolTests.idsOf(await serving.callAsync("teamrun.pageList", { chatId: "c1" }))
      ].join(" | ");

      const artboardPage = first.readString("pageId");
      const withArtboards = await pageIdsOf();
      const refused = [
        await pages.failureAsync(PagesHarness.edit, { page_id: artboardPage, base_version: 1, html: "<p>a2</p>" }),
        await pages.failureAsync(PagesHarness.show, { path: "b.html", title: "B", page_id: artboardPage, base_version: 1 })
      ];
      await pages.callAsync(PagesHarness.edit, { page_id: page, base_version: 1, html: "<p>b2</p>" });
      await pages.callAsync(CanvasToolTests.arrange, { canvas_id: id, base_version: 3, artboards: [{ id: first.readString("id"), remove: true }] });
      const removed = await pageIdsOf();
      const edited = await pages.callAsync(PagesHarness.edit, { page_id: artboardPage, base_version: 1, html: "<p>a2</p>" });

      Assert.areEqual(`${page} | ${id} | ${page}`, withArtboards);
      Assert.areEqual(`${CanvasToolTests.ARTBOARD_PAGE}|${CanvasToolTests.ARTBOARD_PAGE}`, refused.join("|"));
      Assert.areEqual("<p>a</p>", (await pages.callAsync(PagesHarness.read, { page_id: artboardPage, version: 1 })).readString("html"));
      Assert.areEqual(`${page}:2,${artboardPage}:1,${artboardPage}:2`, serving.publishedOf("teamrun.pageUpdated").map(t => Page.fromJson(t))
        .filter(t => t.kind === PageKind.Page).map(t => `${t.id}:${String(t.version)}`).join());
      Assert.areEqual(`${page},${artboardPage} | ${id} | ${page},${artboardPage}`, removed);
      Assert.areEqual(2, edited.readInteger("version"));
    }
    finally {
      await pages.pages.closeAsync();
    }
  }

  @TestMethod
  public async passesOnAnUnexpectedFailureAsItsOutcomeUncertain(): Promise<void> {
    using pages = new PagesHarness();

    pages.host.failure = new Error("The disk is full.");
    const error = await pages.failureAsync(CanvasToolTests.read, { canvas_id: "k1" });
    pages.host.failure = "down";
    const thrown = await pages.failureAsync(CanvasToolTests.read, { canvas_id: "k1" });

    Assert.areEqual("OutcomeUncertain The disk is full.", error);
    Assert.areEqual("OutcomeUncertain down", thrown);
  }

  @TestMethod
  public describesTheCanvasToolsWithTheirRisksAndNextTool(): void {
    const tools = Pages.tools.slice(4);

    Assert.areEqual("teamrun_canvas_create,teamrun_canvas_read,teamrun_canvas_add_artboard,teamrun_canvas_revise_artboard,teamrun_canvas_arrange",
      tools.map(t => t.name).join());
    Assert.areEqual("false,true,false,false,false", tools.map(t => t.hints?.isReadOnly).join());
    Assert.areEqual("true,false,true,true,true", tools.map(t => t.marksSending).join());
    Assert.isTrue(tools.every(t => t.nextTool === "teamrun_canvas_read"));
    Assert.areEqual(JSON.stringify(["canvas_id", "base_version", "path", "title"]), JSON.stringify(tools[2]?.inputSchema["required"]));
  }

  private static async canvasAsync(pages: PagesHarness): Promise<string> {
    return (await pages.callAsync(CanvasToolTests.create, { title: "Options" })).readObject("canvas").readNonBlankString("id");
  }

  private static placeOf(artboard: JsonReader): string {
    return ["x", "y", "width", "height"].map(t => String(artboard.readNumber(t))).join();
  }

  private static idsOf(listed: JsonValue): string {
    return Array.isArray(listed) ? listed.map(t => Page.fromJson(t).id).join() : String.empty;
  }

  private static titlesOf(read: JsonReader): string {
    return read.readObject("manifest").readObjectArray("artboards").map(t => t.readString("title")).join();
  }
}
