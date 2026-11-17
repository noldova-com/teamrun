/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

import { DatabaseContext } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import "@noldova/context.core";
import { ChangeOperation, DataSource, DbContextOptionsBuilder } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Page } from "@noldova/teamrun.protocol";
import { ModuleDatabaseProvider } from "@noldova/teamrun.runtime";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";
import { PagesServing } from "../../fixtures/pages-serving.fixture.js";

@TestClass
export class PagesTests {
  @TestMethod
  public async savesAPageAskedForDuringAnOpenCoreTransactionRightAfterThatTransactionCommits(): Promise<void> {
    using harness = new PagesHarness();
    const core = DatabaseContext.attach(new DbContextOptionsBuilder().use(new ModuleDatabaseProvider(harness.database), new DataSource("teamrun", harness.data)),
      harness.data);
    harness.open(core.database.connection);
    harness.file("a.html", "<p>one</p>");
    const order: string[] = [];
    const entered = Promise.withResolvers<void>();
    const held = Promise.withResolvers<void>();
    const written = core.database.connection.runInTransactionAsync(async transaction => {
      await core.database.changeFeed.appendAsync("Chat", "c1", ChangeOperation.Insert, "{}", transaction);
      entered.resolve();
      await held.promise;
      order.push("core");
    });
    await entered.promise;

    const shown = harness.showAsync().then(id => {
      order.push("page");
      return id;
    });
    held.resolve();
    await written;
    const id = await shown;

    Assert.areEqual("core,page", order.join(","));
    Assert.areEqual(1, (await core.database.changeFeed.readAfterAsync(0)).length);
    Assert.areEqual(1, (await core.database.connection.queryAsync(new SqlQuery("SELECT id FROM pages WHERE id = ?", [id]))).length);
    Assert.isTrue(existsSync(harness.copyOf("c1", id)));
  }

  @TestMethod
  public async registersThePageMethodsAndDeclaresThePageEventsUnderTheModulesName(): Promise<void> {
    using harness = new PagesHarness();
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    await harness.pages.closeAsync();

    Assert.areEqual("teamrun.pageOpen,teamrun.pageRead,teamrun.pageRestore,teamrun.pageList", [...serving.methods.keys()].join(","));
    Assert.areEqual("teamrun.pageShown,teamrun.pageUpdated,teamrun.pageStopped", serving.events.join(","));
  }

  @TestMethod
  public async sendsPageShownWhenATeammateShowsAPageNewOrAgainAndPageUpdatedWhenOneEditsIt(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const id = await harness.showAsync();
      await harness.callAsync(PagesHarness.show, { path: "a.html", title: "A", page_id: id, base_version: 1 });
      await harness.callAsync(PagesHarness.edit, { page_id: id, base_version: 2, html: "<p>three</p>" }, "Sol");

      Assert.areEqual("1,2", serving.publishedOf("teamrun.pageShown").map(t => Page.fromJson(t).version).join(","));
      Assert.areEqual("3:Sol", serving.publishedOf("teamrun.pageUpdated").map(t => `${String(Page.fromJson(t).version)}:${Page.fromJson(t).editedBy.name}`).join(","));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async logsAnEventItCantSendAndStillAnswersTheTool(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const serving = new PagesServing();
    serving.failingEvent = "teamrun.pageShown";
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const id = await harness.showAsync();

      Assert.isTrue(id.length > 0);
      Assert.areEqual("The PageShown event could not be sent (Error).", harness.lines.join("\n"));
    }
    finally {
      await harness.pages.closeAsync();
    }
  }
}
