/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewEvent, WebViewEventKind, type WebViewInfo } from "@noldova/desktop.protocol";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PageView } from "@noldova/teamrun.protocol";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";
import { PagesServing } from "../../fixtures/pages-serving.fixture.js";

@TestClass
export class PageOriginsTests {
  private static readonly sources: string = "https://cdnjs.cloudflare.com,https://cdn.jsdelivr.net,https://unpkg.com,https://fonts.googleapis.com,https://fonts.gstatic.com";

  @TestMethod
  public async givesEveryPageViewTheNewServersOriginsOnEachStartAndTakesThemAwayOnClose(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    const views = [PagesServing.viewOf("v1", id), PagesServing.viewOf("v2", "another-page"), PagesServing.viewOf("v3", id, "image")];
    const first = new PagesServing();
    first.views = views;
    await harness.pages.serveAsync(first, new ManualTimer());
    const before = await PageOriginsTests.originOf(first, id);
    await harness.pages.closeAsync();

    const second = new PagesServing();
    second.views = views;
    await harness.pages.serveAsync(second, new ManualTimer());
    try {
      const after = await PageOriginsTests.originOf(second, id);

      Assert.areEqual(`v1:${before};v2:${before};v1:${before};v1:;v2:`, PageOriginsTests.allowedOf(first));
      Assert.areEqual(`v1:${after};v2:${after};v1:${after}`, PageOriginsTests.allowedOf(second));
      Assert.areEqual(String.empty, harness.lines.join("\n"));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async givesAPageViewItsOriginsWhenItOpensAfterTheWindowAskedForThePageAndNoOtherViewOrEventOrAfterClosing(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    const page = PagesServing.viewOf("v1", id);
    let origin = String.empty;
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      origin = await PageOriginsTests.originOf(serving, id);
      serving.views = [page, PagesServing.viewOf("v2", id, "image")];

      serving.webViews.raiseViewEvent(PageOriginsTests.opened(PagesServing.viewOf("v2", id, "image")));
      serving.webViews.raiseViewEvent(new WebViewEvent("teamrun", "v1", WebViewEventKind.Crashed));
      serving.webViews.raiseViewEvent(PageOriginsTests.opened(PagesServing.viewOf("v9", id)));
      Assert.areEqual(String.empty, PageOriginsTests.allowedOf(serving));
      serving.webViews.raiseViewEvent(PageOriginsTests.opened(page));
      Assert.areEqual(`v1:${origin}`, PageOriginsTests.allowedOf(serving));
    }
    finally {
      await harness.pages.closeAsync();
    }
    serving.views = [page, PagesServing.viewOf("v3", id)];
    serving.webViews.raiseViewEvent(PageOriginsTests.opened(PagesServing.viewOf("v3", id)));

    Assert.areEqual(`v1:${origin};v1:`, PageOriginsTests.allowedOf(serving));
  }

  @TestMethod
  public async logsViewsItCantListOrGiveOriginsByTheErrorsKindAndStillCloses(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    serving.views = [PagesServing.viewOf("v1", id)];
    serving.webViews.answer("setAllowedOriginsAsync", () => Promise.reject(new RangeError("Gone.")));
    await harness.pages.serveAsync(serving, new ManualTimer());
    const failure: unknown = "No views.";
    serving.webViews.answer("list", () => {
      throw failure;
    });

    await harness.pages.closeAsync();

    Assert.areEqual(["A page view's origins could not be set (RangeError).", "The page views could not be listed to set their origins (string)."].join("\n"),
      harness.lines.join("\n"));
  }

  private static async originOf(serving: PagesServing, id: string): Promise<string> {
    const view = PageView.fromJson(await serving.callAsync("teamrun.pageOpen", { pageId: id, version: null }));
    return `${new URL(view.address).origin},${PageOriginsTests.sources}`;
  }

  private static allowedOf(serving: PagesServing): string {
    return serving.allowed.map(([viewId, origins]) => `${viewId}:${origins.join(",")}`).join(";");
  }

  private static opened(view: WebViewInfo): WebViewEvent {
    return new WebViewEvent("teamrun", view.id, WebViewEventKind.Opened, { pane: view.pane.toJson(), profileKey: view.profileKey });
  }
}
