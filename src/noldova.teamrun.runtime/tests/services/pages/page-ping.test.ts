/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ManualTimer } from "@noldova/teamrun.core/testing";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Page } from "@noldova/teamrun.protocol";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";
import { PagesServing } from "../../fixtures/pages-serving.fixture.js";

@TestClass
export class PagePingTests {
  @TestMethod
  public async pingsEachOpenPageViewEveryFiveSecondsWithAThreeSecondEvaluateOfOneAndNoOtherView(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    serving.views = [PagesServing.viewOf("v1", id), PagesServing.viewOf("v2", id, "image"), PagesServing.viewOf("v3", null)];
    serving.webViews.relay.answer("sendAsync", () => Promise.resolve(1));
    const timer = new ManualTimer();
    await harness.pages.serveAsync(serving, timer);
    try {
      timer.advance(4_999);
      const early = serving.webViews.relay.callsOf("sendAsync").length;
      await PagePingTests.roundAsync(timer);
      await PagePingTests.roundAsync(timer);

      Assert.areEqual(0, early);
      Assert.areEqual(JSON.stringify([["v1", "Runtime.evaluate", { expression: "1" }, 3000], ["v3", "Runtime.evaluate", { expression: "1" }, 3000]]),
        JSON.stringify(serving.webViews.relay.callsOf("sendAsync").slice(0, 2)));
      Assert.areEqual(4, serving.webViews.relay.callsOf("sendAsync").length);
      Assert.areEqual(0, serving.publishedOf("teamrun.pageStopped").length);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async sendsPageStoppedOnceForAViewThatTimesOutUntilItAnswersAgain(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    serving.views = [PagesServing.viewOf("v1", id)];
    const answers = [false, false, true, false];
    serving.webViews.relay.answer("sendAsync", () => answers.shift() === true ? Promise.resolve(1) : Promise.reject(PagesServing.timedOut()));
    const timer = new ManualTimer();
    await harness.pages.serveAsync(serving, timer);
    try {
      const stopped: number[] = [];
      for (let round = 0; round < 4; round++) {
        await PagePingTests.roundAsync(timer);
        stopped.push(serving.publishedOf("teamrun.pageStopped").length);
      }

      Assert.areEqual("1,1,1,2", stopped.join(","));
      Assert.areEqual(id, Page.fromJson(serving.publishedOf("teamrun.pageStopped")[0]).id);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async leavesAViewThatCrashedOrClosedToItsOwnEventsAndForgetsAClosedViewThatTimedOut(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    serving.views = [PagesServing.viewOf("v1", id)];
    const answers = [PagesServing.crashed(), PagesServing.timedOut(), PagesServing.timedOut()];
    serving.webViews.relay.answer("sendAsync", () => Promise.reject(answers.shift() ?? PagesServing.timedOut()));
    const timer = new ManualTimer();
    await harness.pages.serveAsync(serving, timer);
    try {
      await PagePingTests.roundAsync(timer);
      const afterCrash = serving.publishedOf("teamrun.pageStopped").length;
      await PagePingTests.roundAsync(timer);
      serving.views = [];
      await PagePingTests.roundAsync(timer);
      serving.views = [PagesServing.viewOf("v1", id)];
      await PagePingTests.roundAsync(timer);

      Assert.areEqual(0, afterCrash);
      Assert.areEqual(2, serving.publishedOf("teamrun.pageStopped").length);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async logsAListingThatFailsOrAStoppedPageItCantFindAndPingsAgainNextRound(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    serving.webViews.relay.answer("sendAsync", () => Promise.reject(PagesServing.timedOut()));
    const timer = new ManualTimer();
    await harness.pages.serveAsync(serving, timer);
    const failures: unknown[] = [new RangeError("The views are gone."), "gone"];
    serving.webViews.answer("list", () => {
      const failure = failures.shift();
      if (!Object.isUndefined(failure))
        throw failure;
      return [PagesServing.viewOf("v1", id), PagesServing.viewOf("v2", "p-removed")];
    });
    try {
      await PagePingTests.roundAsync(timer);
      await PagePingTests.roundAsync(timer);
      await PagePingTests.roundAsync(timer);

      Assert.areEqual(["The page views could not be listed to ping them (RangeError).", "The page views could not be listed to ping them (string).",
        "The PageStopped event could not be sent (PageException)."].join("\n"), harness.lines.join("\n"));
      Assert.areEqual(1, serving.publishedOf("teamrun.pageStopped").length);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async stopsPingingOnceClosed(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    serving.views = [PagesServing.viewOf("v1", id)];
    serving.webViews.relay.answer("sendAsync", () => Promise.resolve(1));
    const timer = new ManualTimer();
    await harness.pages.serveAsync(serving, timer);
    await harness.pages.closeAsync();
    timer.advance(60_000);

    Assert.areEqual(0, timer.pending);
    Assert.areEqual(0, serving.webViews.relay.callsOf("sendAsync").length);
  }

  private static async roundAsync(timer: ManualTimer): Promise<void> {
    const next = timer.delayed;
    timer.advance(5_000);
    await next;
  }
}
