/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MethodFailureException } from "@noldova/desktop.runtime";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import "@noldova/context.core";
import { type JsonValue, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Page, PageView } from "@noldova/teamrun.protocol";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";
import { PagesServing } from "../../fixtures/pages-serving.fixture.js";

@TestClass
export class PageMethodTests {
  private static readonly sources: string = "https://cdnjs.cloudflare.com,https://cdn.jsdelivr.net,https://unpkg.com,https://fonts.googleapis.com,https://fonts.gstatic.com";

  @TestMethod
  public async opensAPageWithItsVersionsNewestFirstAndGivesItsOwnViewsTheOriginsEveryPageViewGotOnStart(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    await harness.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "<p>two</p>" }, "Sol");
    const serving = new PagesServing();
    serving.views = [PagesServing.viewOf("v1", id), PagesServing.viewOf("v2", "another-page"), PagesServing.viewOf("v3", id, "image"),
      PagesServing.viewOf("v4", id)];
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const view = PageView.fromJson(await serving.callAsync("teamrun.pageOpen", { pageId: id, version: null }));
      const origin = new URL(view.address).origin;

      Assert.areEqual("2:Sol,1:Opus", view.versions.map(t => `${String(t.version)}:${t.editedBy.name}`).join(","));
      Assert.areEqual(2, view.version);
      Assert.areEqual(harness.copyOf("c1", id), view.file);
      Assert.isTrue(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
      const allowed = `${origin},${PageMethodTests.sources}`;
      Assert.areEqual(`v1:${allowed};v2:${allowed};v4:${allowed};v1:${allowed};v4:${allowed}`,
        serving.allowed.map(([viewId, origins]) => `${viewId}:${origins.join(",")}`).join(";"));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async readsTheCurrentVersionsOrAKeptVersionsHtml(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    await harness.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "<p>two</p>" });
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      Assert.areEqual("<p>two</p>", await serving.callAsync("teamrun.pageRead", { pageId: id, version: null }));
      Assert.areEqual("<p>one</p>", await serving.callAsync("teamrun.pageRead", { pageId: id, version: 1 }));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async restoresAKeptVersionAsThePagesNextVersionByThePersonAndSendsPageUpdated(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    await harness.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "<p>two</p>" }, "Sol");
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const restored = Page.fromJson(await serving.callAsync("teamrun.pageRestore", { pageId: id, version: 1 }));
      const read = await harness.callAsync(PagesHarness.read, { page_id: id });

      Assert.areEqual("3,You,null,Opus", [restored.version, restored.editedBy.name, String(restored.editedBy.teammateId), restored.madeBy.name].join(","));
      Assert.areEqual("<p>one</p>", read.readString("html"));
      Assert.areEqual(JSON.stringify([restored.toJson()]), JSON.stringify(serving.publishedOf("teamrun.pageUpdated")));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async restoresTwiceAtOnceAsTwoNextVersionsWithoutLosingEither(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    await harness.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "<p>two</p>" }, "Sol");
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const restored = await Promise.all([serving.callAsync("teamrun.pageRestore", { pageId: id, version: 1 }),
        serving.callAsync("teamrun.pageRestore", { pageId: id, version: 2 })]);
      const kept = [await harness.callAsync(PagesHarness.read, { page_id: id, version: 3 }), await harness.callAsync(PagesHarness.read, { page_id: id })];

      Assert.areEqual("3,4", restored.map(t => Page.fromJson(t).version).sort((a, b) => a - b).join(","));
      Assert.areEqual("3 <p>one</p>,4 <p>two</p>", kept.map(t => `${String(t.readInteger("version"))} ${t.readString("html")}`).sort().join(","));
      Assert.areEqual(2, serving.publishedOf("teamrun.pageUpdated").length);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async answersNotFoundForAnUnknownPageOrVersionAndInvalidParamsForAMalformedRequestOrARestoreWithoutAVersion(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const codeOf = async (method: string, payload: JsonValue): Promise<string> =>
        (await Assert.throwsAsync(() => serving.callAsync(method, payload), MethodFailureException)).failure.code;
      const codes = [
        await codeOf("teamrun.pageOpen", { pageId: "p-unknown", version: null }),
        await codeOf("teamrun.pageOpen", { pageId: id, version: 9 }),
        await codeOf("teamrun.pageRead", { pageId: id, version: 9 }),
        await codeOf("teamrun.pageRestore", { pageId: "p-unknown", version: 1 }),
        await codeOf("teamrun.pageOpen", { pageId: " ", version: null }),
        await codeOf("teamrun.pageOpen", { pageId: id, version: 0 }),
        await codeOf("teamrun.pageRead", "page"),
        await codeOf("teamrun.pageRestore", { pageId: id, version: null }),
        await codeOf("teamrun.pageList", { chatId: " " })
      ];

      Assert.areEqual("NotFound,NotFound,NotFound,NotFound,InvalidParams,InvalidParams,InvalidParams,InvalidParams,InvalidParams", codes.join(","));
      Assert.areEqual(0, serving.publishedOf("teamrun.pageUpdated").length);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async listsAChatsPagesTheMostRecentlyChangedFirstAndNoneOfAnotherChat(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    harness.file("b.html", "<p>b</p>");
    const first = await harness.showAsync("a.html");
    const second = await harness.showAsync("b.html");
    await harness.showAsync("a.html", "c2");
    await harness.callAsync(PagesHarness.edit, { page_id: first, base_version: 1, html: "<p>a2</p>" });
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const listed = await serving.callAsync("teamrun.pageList", { chatId: "c1" });
      const none = await serving.callAsync("teamrun.pageList", { chatId: "c3" });

      Assert.areEqual(`${first}:2,${second}:1`, (Array.isArray(listed) ? listed : []).map(t => `${Page.fromJson(t).id}:${String(Page.fromJson(t).version)}`).join(","));
      Assert.areEqual("[]", JSON.stringify(none));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async opensAPageFromItsIdAloneWhateverItsChat(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync("a.html", "c2");
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const view = PageView.fromJson(JsonReader.fromValue(await serving.callAsync("teamrun.pageOpen", { pageId: id, version: 1 })).toJson());

      Assert.areEqual("c2", view.page.chatId);
      Assert.isTrue(view.address.endsWith("&v=1"));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }
}
