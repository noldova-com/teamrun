/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

import { ToolFailureException } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Pages } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../../fixtures/memory-module-database.fixture.js";
import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";

@TestClass
export class PageToolTests {
  @TestMethod
  public async showsTheFileFromTheCallersFolderAsTheCallersAuthorAndMarksSending(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const call = PagesHarness.callOf({ path: "a.html", title: "A" });

    const result = await pages.handlerOf(PagesHarness.show).handleAsync(call);

    const page = PagesHarness.answerOf(result);
    Assert.areEqual(1, page.readInteger("version"));
    Assert.areEqual(JSON.stringify({ teammateId: "t-opus", name: "Opus" }), JSON.stringify(page.readObject("madeBy").toJson()));
    Assert.areEqual("teamrun:teamrun_show_page", result.content[0]?.origin);
    Assert.isTrue(call.hasMarkedSending);
    Assert.isTrue(existsSync(pages.copyOf("c1", page.readNonBlankString("id"))));
  }

  @TestMethod
  public async listsTheChatsPagesWithoutMarkingSending(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await pages.showAsync();
    const call = PagesHarness.callOf({});

    const result = await pages.handlerOf(PagesHarness.list).handleAsync(call);

    Assert.areEqual(id, PagesHarness.answerOf(result).readObjectArray("pages").map(t => t.readNonBlankString("id")).join());
    Assert.isFalse(call.hasMarkedSending);
  }

  @TestMethod
  public async readsAVersionWithWhoMadeItAndItsHtmlMarkedUntrusted(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await pages.showAsync();
    await pages.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "<p>b</p>" }, "Sol");

    const current = await pages.callAsync(PagesHarness.read, { page_id: id });
    const first = await pages.callAsync(PagesHarness.read, { page_id: id, version: 1 });

    Assert.areEqual(JSON.stringify([2, "Sol", "<p>b</p>", "untrusted"]), JSON.stringify([current.readInteger("version"),
      current.readObject("editedBy").readString("name"), current.readString("html"), current.readString("htmlTrust")]));
    Assert.areEqual(JSON.stringify([1, "Opus", "<p>a</p>"]), JSON.stringify([first.readInteger("version"), first.readObject("editedBy").readString("name"),
      first.readString("html")]));
  }

  @TestMethod
  public async editsWithReplacementsAndATitleAndMarksSending(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await pages.showAsync();
    const call = PagesHarness.callOf({ page_id: id, base_version: 1, edits: [{ find: "a", replace: "c" }], title: "B" });

    const page = PagesHarness.answerOf(await pages.handlerOf(PagesHarness.edit).handleAsync(call));

    Assert.areEqual("2 B", `${String(page.readInteger("version"))} ${page.readNonBlankString("title")}`);
    Assert.isTrue(call.hasMarkedSending);
  }

  @TestMethod
  public async marksSendingOnlyOnceEveryCheckPassesSoARefusalKeepsItsCode(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await pages.showAsync();
    const shown = PagesHarness.callOf({ path: "../a.html", title: "A" });
    const edited = PagesHarness.callOf({ page_id: id, base_version: 2, html: "<p>b</p>" });

    const refused = await Assert.throwsAsync(() => pages.handlerOf(PagesHarness.show).handleAsync(shown), ToolFailureException);
    const stale = await Assert.throwsAsync(() => pages.handlerOf(PagesHarness.edit).handleAsync(edited), ToolFailureException);

    Assert.areEqual("Refused Stale", `${refused.failure.code} ${stale.failure.code}`);
    Assert.isFalse(shown.hasMarkedSending);
    Assert.isFalse(edited.hasMarkedSending);
  }

  @TestMethod
  public async passesOnAnUnexpectedFailureAsItsOutcomeUncertain(): Promise<void> {
    using pages = new PagesHarness();

    pages.host.failure = new Error("The disk is full.");
    const error = await pages.failureAsync(PagesHarness.list, {});
    pages.host.failure = "down";
    const thrown = await pages.failureAsync(PagesHarness.list, {});

    Assert.areEqual("OutcomeUncertain The disk is full.", error);
    Assert.areEqual("OutcomeUncertain down", thrown);
  }

  @TestMethod
  public async removesAChatsPagesAndSweepsTheChatsTheHostNoLongerHas(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const first = await pages.showAsync();
    await pages.showAsync("a.html", "c2");
    await pages.showAsync("a.html", "c3");
    await pages.pages.removeChatAsync("c1");
    pages.host.chats = new Set(["c3"]);

    await pages.pages.sweepAsync();

    Assert.isFalse(existsSync(pages.copyOf("c1", first)));
    Assert.areEqual(1, pages.database.readAll("SELECT id FROM pages").length);
    Assert.areEqual(0, pages.lines.length);
  }

  @TestMethod
  public async logsEachChatItCannotSweepAndSweepsTheRestSoTheAppStillStarts(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    await pages.showAsync("a.html", "c1");
    await pages.showAsync("a.html", "c2");
    pages.host.chats = new Set();
    pages.database.run("DROP TABLE pageVersions");

    await pages.pages.sweepAsync();
    pages.host.chatFailure = "down";
    await pages.pages.sweepAsync();

    Assert.areEqual(4, pages.lines.length);
    Assert.isTrue(pages.lines.slice(0, 2).every(t => /^The pages of chat c[12] could not be swept \(\w+\)\.$/.test(t)));
    Assert.areEqual("The pages of chat c1 could not be swept (string).|The pages of chat c2 could not be swept (string).", [...pages.lines.slice(2)].sort().join("|"));
  }

  @TestMethod
  public async logsAListingOfTheChatsThatFailsAndEndsTheSweepSoTheAppStillStarts(): Promise<void> {
    using pages = new PagesHarness();
    pages.file("a.html", "<p>a</p>");
    const id = await pages.showAsync("a.html", "c1");
    pages.host.chats = new Set();
    pages.database.run("DROP TABLE pageVersions");
    pages.database.run("DROP TABLE pages");

    await pages.pages.sweepAsync();

    Assert.areEqual(1, pages.lines.length);
    Assert.isTrue(/^The chats with pages could not be listed to sweep \(\w+\)\.$/.test(pages.lines[0] ?? ""));
    Assert.isTrue(existsSync(pages.copyOf("c1", id)));
  }

  @TestMethod
  public describesTheToolsWithTheirRisksTitlesAndNextTool(): void {
    const pageTools = Pages.tools.slice(0, 4);

    Assert.areEqual("teamrun_show_page,teamrun_list_pages,teamrun_read_page,teamrun_edit_page", pageTools.map(t => t.name).join());
    Assert.areEqual("false,true,true,false", pageTools.map(t => t.hints?.isReadOnly).join());
    Assert.areEqual("true,false,false,true", pageTools.map(t => t.marksSending).join());
    Assert.isTrue(pageTools.every(t => t.nextTool === "teamrun_list_pages"));
    Assert.areEqual(JSON.stringify(["page_id", "base_version"]), JSON.stringify(pageTools[3]?.inputSchema["required"]));
    Assert.isTrue(JSON.stringify(pageTools[0]?.inputSchema["properties"]).includes("\"base_version\":{\"type\":\"integer\""));
    Assert.areEqual("120,120", [pageTools[0], pageTools[3]].map(t => JSON.stringify(t?.inputSchema["properties"]).match(/"title":\{[^}]*"maxLength":(\d+)/)?.[1]).join());
    Assert.isTrue(pageTools[0]?.description.includes("light and dark") === true);
  }

  @TestMethod
  public asksATeammateToShowAPageWithTheToolRatherThanServeItOrOpenItInABrowser(): void {
    const description = Pages.tools[0]?.description ?? "";

    Assert.isTrue(description.includes("Use it whenever the person asks you to show something as a page or a visual, or to make a page, a report, "
      + "a dashboard, a chart or a mock-up: write the HTML file and show it with this tool. Never serve the file on a local port or open it in a browser "
      + "for this: TeamRun's browser opens a local address only for a site the person allowed, so the person would usually see an empty tab. "));
  }

  @TestMethod
  public buildsItsTablesWithoutAnyOfTeamRuns(): void {
    using database = new MemoryModuleDatabase(Pages.migrations);

    const tables = database.readAll("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map(t => String(t["name"]));

    Assert.areEqual("pageVersions,pages", tables.join());
    Assert.areEqual("20261111000000-pages", Pages.migrations.map(t => t.id).join());
  }
}
