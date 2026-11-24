/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DataDirectory, MethodFailureException, ModuleDatabase } from "@noldova/desktop.runtime";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Pages } from "@noldova/teamrun.runtime";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";
import { PagesServing } from "../../fixtures/pages-serving.fixture.js";
import { RecordingOutput } from "../../fixtures/recording-output.fixture.js";

@TestClass
export class PagesStoreTests {
  private static readonly MAXIMUM_BYTES: number = 5 * 1024 * 1024;
  private static readonly OUTSIDE_FOLDER: string = "Refused The file isn't in this chat's folder. Write the page in the chat's folder and show it from there.";
  private static readonly FILE_MISSING: string = "Refused The file doesn't exist or isn't a file.";
  private static readonly NOT_HTML: string = "Refused The file isn't an HTML page. Show a file whose name ends in .html or .htm.";
  private static readonly TOO_LARGE: string =
    "TooLarge The page is over 5 MB. Keep it smaller, for example by loading a large library from cdnjs, jsDelivr or unpkg.";
  private static readonly NOT_A_PAGE: string = "Refused That id is a canvas, not a page. Use the canvas tools, such as teamrun_canvas_read, for it.";
  private static readonly UNKNOWN: string = "Refused This chat has no page with that id. List the chat's pages to find it.";
  private static readonly STALE: string = "Stale The page has changed since that version. Read its current version and edit that.";
  private static readonly TITLE_TOO_LONG: string = "Refused The title is over 120 characters. Give a shorter one.";

  @TestMethod
  public async showsAFileFromTheChatsFolderAsAPageWithItsAuthorAndASavedCopy(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("options.html", "<h1>Options</h1>");

    const page = await pages.callAsync(PagesHarness.show, { path: "options.html", title: "Options" });

    const id = page.readNonBlankString("id");
    Assert.areEqual(1, page.readInteger("version"));
    Assert.areEqual("Opus Opus", `${page.readObject("madeBy").readString("name")} ${page.readObject("editedBy").readString("name")}`);
    Assert.areEqual(16, page.readInteger("bytes"));
    Assert.areEqual("<h1>Options</h1>", readFileSync(pages.copyOf("c1", id), "utf8"));
    Assert.areEqual(id, (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages").map(t => t.readString("id")).join());
  }

  @TestMethod
  public async showsAgainWithTheIdAndTheVersionReadAsTheNextVersionKeepingWhoMadeIt(): Promise<void> {
    using pages = new PagesHarness();
    const file = pages.file("a.html", "one");
    const first = await pages.callAsync(PagesHarness.show, { path: "a.html", title: "A" });
    const id = first.readNonBlankString("id");
    pages.file("a.html", "two");

    const second = await pages.callAsync(PagesHarness.show, { path: file, title: "A, again", page_id: id, base_version: 1 }, "Sol");

    Assert.areEqual(id, second.readNonBlankString("id"));
    Assert.areEqual("2 A, again", `${String(second.readInteger("version"))} ${second.readString("title")}`);
    Assert.areEqual("Opus Sol", `${second.readObject("madeBy").readString("name")} ${second.readObject("editedBy").readString("name")}`);
    Assert.areEqual(first.readString("createdAt"), second.readString("createdAt"));
    Assert.areEqual("two", (await pages.callAsync(PagesHarness.read, { page_id: id })).readString("html"));
    const earlier = await pages.callAsync(PagesHarness.read, { page_id: id, version: 1 });
    Assert.areEqual("one Opus", `${earlier.readString("html")} ${earlier.readObject("editedBy").readString("name")}`);
    Assert.areEqual(1, (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages").length);
  }

  @TestMethod
  public async refusesShowingAgainFromAnOlderVersionOrWithoutOneSoAnotherTeammatesEditStays(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "mine");
    const id = await pages.showAsync();
    await pages.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "theirs" }, "Sol");

    const stale = await pages.failureAsync(PagesHarness.show, { path: "a.html", title: "A", page_id: id, base_version: 1 });
    const missing = await pages.failureAsync(PagesHarness.show, { path: "a.html", title: "A", page_id: id });

    Assert.areEqual(`${PagesStoreTests.STALE} Its current version is 2.`, stale);
    Assert.areEqual("Refused Give base_version, the version you last read, with page_id.", missing);
    Assert.areEqual("theirs 2", await PagesStoreTests.currentAsync(pages, id));
  }

  @TestMethod
  public async keepsTheSavedCopyOfTheVersionTheDatabaseHoldsWhenAShowOrAnEditFailsToCommit(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "one");
    const id = await pages.showAsync();
    pages.file("a.html", "two");
    pages.database.failsCommit = true;

    await Assert.throwsAsync(() => pages.callAsync(PagesHarness.show, { path: "a.html", title: "A", page_id: id, base_version: 1 }), Error);
    await Assert.throwsAsync(() => pages.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "three" }), Error);
    const copy = readFileSync(pages.copyOf("c1", id), "utf8");
    pages.database.failsCommit = false;

    Assert.areEqual("one one 1", `${copy} ${await PagesStoreTests.currentAsync(pages, id)}`);
  }

  @TestMethod
  public async keepsAShowsSavedVersionAndLogsWhyWhenItsCopyCantBeWrittenAfterTheCommit(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "one");
    const id = await pages.showAsync();
    pages.file("a.html", "two");
    rmSync(pages.copyOf("c1", id));
    mkdirSync(pages.copyOf("c1", id));

    const shown = await pages.callAsync(PagesHarness.show, { path: "a.html", title: "A", page_id: id, base_version: 1 });
    rmSync(pages.copyOf("c1", id), { recursive: true });

    Assert.areEqual(JSON.stringify([2, 1]), JSON.stringify([shown.readInteger("version"),
      pages.lines.filter(t => t.startsWith("A page's version was saved, but its copy for showing could not be written (")).length]));
  }

  @TestMethod
  public async takesOneOfTwoShowsAgainFromTheSameVersionAtOnceAndRefusesTheOtherStale(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const id = await pages.showAsync();
    const input = { path: "a.html", title: "A", page_id: id, base_version: 1 };

    const outcomes = await Promise.all([pages.outcomeAsync(PagesHarness.show, input), pages.outcomeAsync(PagesHarness.show, input, "Sol")]);

    Assert.areEqual(`Taken|${PagesStoreTests.STALE} Its current version is 2.`, outcomes.join("|"));
    Assert.areEqual("a 2", await PagesStoreTests.currentAsync(pages, id));
  }

  @TestMethod
  public async takesOneOfTwoEditsFromTheSameVersionAtOnceAndRefusesTheOtherStale(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const id = await pages.showAsync();

    const outcomes = await Promise.all([pages.outcomeAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "b" }),
      pages.outcomeAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "c" }, "Sol")]);

    Assert.areEqual(`Taken|${PagesStoreTests.STALE} Its current version is 2.`, outcomes.join("|"));
    Assert.areEqual("b 2", await PagesStoreTests.currentAsync(pages, id));
  }

  @TestMethod
  public async refusesAFileOutsideTheChatsFolderOrReachedThroughALinkOutOfIt(): Promise<void> {
    using pages = new PagesHarness();
    const outside = pages.directory.resolve("outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "x.html"), "x");
    symlinkSync(outside, join(pages.work, "linked"), "junction");

    for (const path of [join(outside, "x.html"), "../outside/x.html", "linked/x.html"])
      Assert.areEqual(PagesStoreTests.OUTSIDE_FOLDER, await pages.failureAsync(PagesHarness.show, { path, title: "X" }));
    Assert.areEqual(0, (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages").length);
  }

  @TestMethod
  public async refusesAMissingFileAFolderAndAFileThatIsntHtml(): Promise<void> {
    using pages = new PagesHarness();
    mkdirSync(join(pages.work, "folder.html"));
    pages.file("notes.txt", "text");
    pages.file("upper.HTM", "upper");

    Assert.areEqual(PagesStoreTests.FILE_MISSING, await pages.failureAsync(PagesHarness.show, { path: "missing.html", title: "M" }));
    Assert.areEqual(PagesStoreTests.FILE_MISSING, await pages.failureAsync(PagesHarness.show, { path: "folder.html", title: "F" }));
    Assert.areEqual(PagesStoreTests.NOT_HTML, await pages.failureAsync(PagesHarness.show, { path: "notes.txt", title: "N" }));
    Assert.areEqual(1, (await pages.callAsync(PagesHarness.show, { path: "upper.HTM", title: "U" })).readInteger("version"));
  }

  @TestMethod
  public async refusesAFileOver5MegabytesAndTakesOneOfExactly5(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("big.html", "a".repeat(PagesStoreTests.MAXIMUM_BYTES + 1));
    pages.file("limit.html", "a".repeat(PagesStoreTests.MAXIMUM_BYTES));

    Assert.areEqual(PagesStoreTests.TOO_LARGE, await pages.failureAsync(PagesHarness.show, { path: "big.html", title: "B" }));
    Assert.areEqual(PagesStoreTests.MAXIMUM_BYTES, (await pages.callAsync(PagesHarness.show, { path: "limit.html", title: "L" })).readInteger("bytes"));
  }

  @TestMethod
  public async refusesAFileUnder5MegabytesWhoseInvalidUtf8GrowsOver5OnceDecoded(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("bytes.html", Buffer.alloc(PagesStoreTests.MAXIMUM_BYTES / 2, 0xff));

    Assert.areEqual(PagesStoreTests.TOO_LARGE, await pages.failureAsync(PagesHarness.show, { path: "bytes.html", title: "B" }));
    Assert.isFalse(existsSync(join(pages.data, "pages")));
  }

  @TestMethod
  public async refusesATitleOver120CharactersWhenShowingOrEditing(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const id = (await pages.callAsync(PagesHarness.show, { path: "a.html", title: "t".repeat(120) })).readNonBlankString("id");

    Assert.areEqual(PagesStoreTests.TITLE_TOO_LONG, await pages.failureAsync(PagesHarness.show, { path: "a.html", title: "t".repeat(121) }));
    Assert.areEqual(PagesStoreTests.TITLE_TOO_LONG, await pages.failureAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "b", title: "t".repeat(121) }));
    Assert.areEqual("a 1", await PagesStoreTests.currentAsync(pages, id));
  }

  @TestMethod
  public async countsATitleInCharactersSoSixtyOneEmojiAreTaken(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const title = "\u{1F600}".repeat(61);

    const page = await pages.callAsync(PagesHarness.show, { path: "a.html", title });

    Assert.areEqual(title, page.readNonBlankString("title"));
    Assert.areEqual(PagesStoreTests.TITLE_TOO_LONG, await pages.failureAsync(PagesHarness.show, { path: "a.html", title: "\u{1F600}".repeat(121) }));
  }

  @TestMethod
  public async treatsAPageOfAnotherChatAsUnknown(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const id = await pages.showAsync();

    Assert.areEqual(PagesStoreTests.UNKNOWN, await pages.failureAsync(PagesHarness.read, { page_id: id }, "Opus", "c2"));
    Assert.areEqual(PagesStoreTests.UNKNOWN, await pages.failureAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "b" }, "Sol", "c2"));
    Assert.areEqual(PagesStoreTests.UNKNOWN, await pages.failureAsync(PagesHarness.show, { path: "a.html", title: "A", page_id: "missing", base_version: 1 }));
    Assert.areEqual(0, (await pages.callAsync(PagesHarness.list, {}, "Opus", "c2")).readObjectArray("pages").length);
  }

  @TestMethod
  public async editsByReplacingTheHtmlOrByReplacementsAppliedInOrder(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>one</p><p>two</p>");
    const id = await pages.showAsync();

    const replaced = await pages.callAsync(PagesHarness.edit,
      { page_id: id, base_version: 1, edits: [{ find: "one", replace: "$& and $1" }, { find: "$& and $1</p><p>two", replace: "first</p><p>second" }], title: "A, edited" },
      "Sol");
    const rewritten = await pages.callAsync(PagesHarness.edit, { page_id: id, base_version: 2, html: "<p>new</p>" });

    Assert.areEqual("2 A, edited Sol", `${String(replaced.readInteger("version"))} ${replaced.readString("title")} ${replaced.readObject("editedBy").readString("name")}`);
    Assert.areEqual("<p>first</p><p>second</p>", (await pages.callAsync(PagesHarness.read, { page_id: id, version: 2 })).readString("html"));
    Assert.areEqual("3 A, edited Opus", `${String(rewritten.readInteger("version"))} ${rewritten.readString("title")} ${rewritten.readObject("editedBy").readString("name")}`);
    Assert.isTrue(rewritten.readString("path").endsWith("a.html"));
    Assert.areEqual("<p>new</p>", readFileSync(pages.copyOf("c1", id), "utf8"));
  }

  @TestMethod
  public async refusesAnEditFromAnOlderVersionNamingTheCurrentOne(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const id = await pages.showAsync();
    await pages.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "b" }, "Sol");

    Assert.areEqual(`${PagesStoreTests.STALE} Its current version is 2.`,
      await pages.failureAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "c" }));
    Assert.areEqual("b 2", await PagesStoreTests.currentAsync(pages, id));
  }

  @TestMethod
  public async refusesAnEditWithBothOrNeitherOrAFindThatIsntThereExactlyOnceNamingTheEdit(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "aa b");
    const id = await pages.showAsync();
    const edit = (input: JsonObject): Promise<string> => pages.failureAsync(PagesHarness.edit, { page_id: id, base_version: 1, ...input }, "Sol");

    Assert.areEqual("Refused Give either the page's new HTML or at least one edit, not both.", await edit({}));
    Assert.areEqual("Refused Give either the page's new HTML or at least one edit, not both.", await edit({ html: "x", edits: [{ find: "b", replace: "c" }] }));
    Assert.areEqual("Refused An edit's text to find isn't in the page. Read the page and copy the text exactly. It's edit 2.",
      await edit({ edits: [{ find: "b", replace: "c" }, { find: "z", replace: "y" }] }));
    Assert.areEqual("Refused An edit's text to find is in the page more than once. Include more of the text around it so it matches once. It's edit 1.",
      await edit({ edits: [{ find: "a", replace: "c" }] }));
    Assert.isTrue((await edit({ edits: [{ find: "", replace: "c" }] })).startsWith("OutcomeUncertain "));
    Assert.areEqual("aa b 1", await PagesStoreTests.currentAsync(pages, id));
  }

  @TestMethod
  public async refusesAnEditThatWouldPassTheLimit(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const id = await pages.showAsync();

    Assert.areEqual(PagesStoreTests.TOO_LARGE, await pages.failureAsync(PagesHarness.edit,
      { page_id: id, base_version: 1, edits: [{ find: "a", replace: "é".repeat(PagesStoreTests.MAXIMUM_BYTES / 2 + 1) }] }, "Sol"));
    Assert.areEqual("a 1", await PagesStoreTests.currentAsync(pages, id));
  }

  @TestMethod
  public async keepsTheLast50VersionsAndRefusesAnOlderOne(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "v1");
    const id = await pages.showAsync();
    for (let version = 1; version <= 50; version++)
      await pages.callAsync(PagesHarness.edit, { page_id: id, base_version: version, html: `v${String(version + 1)}` }, "Sol");

    Assert.areEqual("v2", (await pages.callAsync(PagesHarness.read, { page_id: id, version: 2 })).readString("html"));
    Assert.areEqual("v51", (await pages.callAsync(PagesHarness.read, { page_id: id, version: 51 })).readString("html"));
    Assert.areEqual("Refused The page has no such version. Only its last 50 versions are kept.",
      await pages.failureAsync(PagesHarness.read, { page_id: id, version: 1 }));
  }

  @TestMethod
  public async keepsPagesAcrossARestart(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "kept");
    const directory = new DataDirectory(pages.directory.resolve("database"));
    let id = "";
    {
      using database = await ModuleDatabase.openAsync(directory, "teamrun", Pages.migrations, new Date(), new RecordingOutput());
      pages.restart(database);
      id = await pages.showAsync();
    }

    using reopened = await ModuleDatabase.openAsync(directory, "teamrun", Pages.migrations, new Date(), new RecordingOutput());
    pages.restart(reopened);

    Assert.areEqual("kept 1", await PagesStoreTests.currentAsync(pages, id));
    Assert.areEqual("Opus", (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages")[0]?.readObject("madeBy").readString("name"));
  }

  @TestMethod
  public async removesAChatsPagesVersionsAndCopiesLeavingTheOtherChats(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const id = await pages.showAsync();
    await pages.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "b" }, "Sol");
    const kept = await pages.showAsync("a.html", "c2");

    await pages.pages.removeChatAsync("c1");

    Assert.areEqual(0, (await pages.callAsync(PagesHarness.list, {})).readObjectArray("pages").length);
    Assert.areEqual(0, pages.database.readAll("SELECT pageId FROM pageVersions WHERE chatId = 'c1'").length);
    Assert.isFalse(existsSync(pages.copyOf("c1", id)));
    Assert.areEqual("a 1", await PagesStoreTests.currentAsync(pages, kept, "c2"));
    Assert.isTrue(existsSync(pages.copyOf("c2", kept)));
  }

  @TestMethod
  public async listsOnlyTheChatsPagesLeavingOutArtboardsAndItsCanvasesApart(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "a");
    const first = await pages.showAsync();
    const second = await pages.showAsync();
    const other = await pages.showAsync("a.html", "c2");
    const canvas = (await pages.callAsync("teamrun_canvas_create", { title: "Options" })).readObject("canvas").readString("id");
    await pages.callAsync("teamrun_canvas_add_artboard", { canvas_id: canvas, base_version: 1, path: "a.html", title: "A" });
    await pages.callAsync(PagesHarness.edit, { page_id: first, base_version: 1, html: "b" });

    const listed = await pages.callAsync(PagesHarness.list, {});
    const otherListed = await pages.callAsync(PagesHarness.list, {}, "Opus", "c2");

    Assert.areEqual(`${first},${second} ${canvas}`, `${listed.readObjectArray("pages").map(t => t.readString("id")).join()} `
      + listed.readObjectArray("canvases").map(t => t.readString("id")).join());
    Assert.areEqual(`${other} `, `${otherListed.readObjectArray("pages").map(t => t.readString("id")).join()} `
      + otherListed.readObjectArray("canvases").map(t => t.readString("id")).join());
  }

  @TestMethod
  public async findsAPageOfAnyChatByItsIdButNotACanvasOrAnUnknownId(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const other = await pages.showAsync("a.html", "c2");
    const canvas = (await pages.callAsync("teamrun_canvas_create", { title: "Options" })).readObject("canvas").readString("id");
    const serving = new PagesServing();
    await pages.pages.serveAsync(serving, new ManualTimer());
    try {
      const messageOf = async (pageId: string): Promise<string> =>
        (await Assert.throwsAsync(() => serving.callAsync("teamrun.pageRead", { pageId, version: 1 }), MethodFailureException)).failure.message;

      const read = await serving.callAsync("teamrun.pageRead", { pageId: other, version: 1 });

      Assert.areEqual("<p>a</p>", read);
      Assert.areEqual([PagesStoreTests.NOT_A_PAGE, PagesStoreTests.UNKNOWN].map(t => t.slice("Refused ".length)).join("|"),
        [await messageOf(canvas), await messageOf("p-unknown")].join("|"));
    }
    finally {
      await pages.pages.closeAsync();
    }
  }

  private static async currentAsync(pages: PagesHarness, id: string, chatId: string = "c1"): Promise<string> {
    const read = await pages.callAsync(PagesHarness.read, { page_id: id }, "Opus", chatId);
    return `${read.readString("html")} ${String(read.readInteger("version"))}`;
  }
}
