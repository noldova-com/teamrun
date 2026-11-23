/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createServer } from "node:http";

import { MethodFailureException } from "@noldova/desktop.runtime";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PageMethodName, PageView } from "@noldova/teamrun.protocol";
import { Pages } from "@noldova/teamrun.runtime";

import { PagesHarness } from "../../fixtures/pages-harness.fixture.js";
import { type PageAnswer, PagesServing } from "../../fixtures/pages-serving.fixture.js";
import { PipeAddressServer } from "../../fixtures/pipe-address-server.fixture.js";
import { RefusingServer } from "../../fixtures/refusing-server.fixture.js";

@TestClass
export class PageServerTests {
  private static readonly policy: string = "sandbox allow-scripts allow-modals allow-popups-to-escape-sandbox; default-src 'none'; base-uri 'none'; "
    + "form-action 'none'; frame-src 'none'; connect-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; "
    + "style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:";

  @TestMethod
  public async servesTheCurrentVersionAndAKeptOneAtTheirAddressesUnderTheSandboxPolicyWithoutCaching(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>one</p>");
    const id = await harness.showAsync();
    await harness.callAsync(PagesHarness.edit, { page_id: id, base_version: 1, html: "<p>two</p>" });
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const current = await PageServerTests.openAsync(serving, id, null);
      const kept = await PageServerTests.openAsync(serving, id, 1);
      const answers = [await PagesServing.getAsync(current.address), await PagesServing.getAsync(kept.address)];

      Assert.areEqual("<p>two</p>,<p>one</p>", answers.map(t => t.body).join(","));
      Assert.isTrue(kept.address.startsWith(`${current.address}&v=1`));
      for (const answer of answers) {
        Assert.areEqual(200, answer.status);
        Assert.areEqual("text/html; charset=utf-8", answer.headers["content-type"]);
        Assert.areEqual(PageServerTests.policy, answer.headers["content-security-policy"]);
        Assert.areEqual("nosniff,no-referrer,no-store", [answer.headers["x-content-type-options"], answer.headers["referrer-policy"], answer.headers["cache-control"]].join(","));
      }
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async refusesAnotherPagesKeyAWrongOrMissingKeyAnUnknownVersionACanvasAndAnyOtherPathOrParameterWith404AndNoBody(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    harness.file("b.html", "<p>b</p>");
    const first = await harness.showAsync("a.html");
    const second = await harness.showAsync("b.html");
    const canvas = (await harness.callAsync("teamrun_canvas_create", { title: "Options" })).readObject("canvas").readString("id");
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const address = new URL((await PageServerTests.openAsync(serving, first, null)).address);
      const key = address.searchParams.get("k") ?? String.empty;
      const at = (path: string): string => `${address.origin}${path}`;
      const answers = await Promise.all([
        at(`/pages/${second}?k=${key}`), at(`/pages/${first}`), at(`/pages/${first}?k=${key.slice(1)}`), at(`/pages/${first}?k=${key}x`),
        at(`/pages/${first}?k=${key}&v=9`), at(`/pages/${first}?k=${key}&v=0`), at(`/pages/${first}?k=${key}&v=one`), at(`/pages/${first}?k=${key}&k=${key}`),
        at(`/pages/${first}?k=${key}&x=1`), at(`/pages/${first}/more?k=${key}`), at(`/pages/unknown-page?k=${key}`), at(`/pages/${canvas}?k=${key}`),
        at(`/pages/${canvas}?k=${key}&v=1`), at("/"), at("/favicon.ico")
      ].map(t => PagesServing.getAsync(t)));

      for (const answer of answers)
        PageServerTests.expectRefused(answer, 404);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async refusesAnotherHostWith403AndAnyMethodButGetWith405(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const address = (await PageServerTests.openAsync(serving, id, null)).address;
      const port = new URL(address).port;
      const hosts = [await PagesServing.getAsync(address, `localhost:${port}`), await PagesServing.getAsync(address, `attacker.example:${port}`)];
      const methods = [await PagesServing.getAsync(address, undefined, "POST"), await PagesServing.getAsync(address, undefined, "HEAD")];

      for (const answer of hosts)
        PageServerTests.expectRefused(answer, 403);
      for (const answer of methods) {
        PageServerTests.expectRefused(answer, 405);
        Assert.areEqual("GET", answer.headers.allow);
      }
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async givesAPageAnotherKeyAtTheNextStartAndStopsServingOnceClosed(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    const before = (await PageServerTests.openAsync(serving, id, null)).address;
    await harness.pages.closeAsync();
    const closed = await Assert.throwsAsync(() => PagesServing.getAsync(before), Error);

    const pages = harness.restart(harness.database);
    const again = new PagesServing();
    await pages.serveAsync(again, new ManualTimer());
    try {
      const after = (await PageServerTests.openAsync(again, id, null)).address;

      Assert.isTrue(closed.message.length > 0);
      Assert.areNotEqual(new URL(before).searchParams.get("k"), new URL(after).searchParams.get("k"));
      Assert.areEqual(200, (await PagesServing.getAsync(after)).status);
    }
    finally {
      await pages.closeAsync();
    }
  }

  @TestMethod
  public async answers500WithNoBodyWhenThePageCantBeRead(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const serving = new PagesServing();
    await harness.pages.serveAsync(serving, new ManualTimer());
    try {
      const address = (await PageServerTests.openAsync(serving, id, null)).address;
      harness.database.run("UPDATE pages SET json = '{}' WHERE id = ?", id);

      PageServerTests.expectRefused(await PagesServing.getAsync(address), 500);
    }
    finally {
      await harness.pages.closeAsync();
    }
  }

  @TestMethod
  public async logsAFailureOfTheListeningServerByKindAndKeepsServing(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const server = createServer();
    const pages = new Pages(harness.connection, harness.data, harness.host, { write: (t: string): void => void harness.lines.push(t) }, server);
    const serving = new PagesServing();
    await pages.serveAsync(serving, new ManualTimer());
    try {
      server.emit("error", Object.assign(new Error("Too many open files."), { code: "EMFILE" }));
      const opened = await PageServerTests.openAsync(serving, id, null);

      Assert.areEqual("The page server failed while serving pages (Error).", harness.lines.join("|"));
      Assert.areEqual(200, (await PagesServing.getAsync(opened.address)).status);
    }
    finally {
      await pages.closeAsync();
    }
  }

  @TestMethod
  public async logsAServerThatCantListenOrHasNoPortStillRegistersTheMethodsAndAnswersOpeningUnavailable(): Promise<void> {
    using harness = new PagesHarness();
    harness.file("a.html", "<p>a</p>");
    const id = await harness.showAsync();
    const log = { write: (t: string): void => void harness.lines.push(t) };
    const refused = new Pages(harness.connection, harness.data, harness.host, log, new RefusingServer());
    const portless = new Pages(harness.connection, harness.data, harness.host, log, new PipeAddressServer());
    const serving = new PagesServing();
    const timer = new ManualTimer();
    await refused.serveAsync(serving, timer);
    await portless.serveAsync(new PagesServing(), timer);
    try {
      const failure = await Assert.throwsAsync(() => serving.callAsync("teamrun.pageOpen", { pageId: id, version: null }), MethodFailureException);

      Assert.areEqual(["The page server could not listen, so pages can't be shown (Error).",
        "The page server could not listen, so pages can't be shown (PageException)."].join("\n"), harness.lines.join("\n"));
      Assert.areEqual("Unavailable", failure.failure.code);
      Assert.areEqual(Object.values(PageMethodName).length, serving.methods.size);
      Assert.areEqual(0, timer.pending);
    }
    finally {
      await refused.closeAsync();
      await portless.closeAsync();
    }
  }

  private static async openAsync(serving: PagesServing, pageId: string, version: number | null): Promise<PageView> {
    return PageView.fromJson(JsonReader.fromValue(await serving.callAsync("teamrun.pageOpen", { pageId, version })).toJson());
  }

  private static expectRefused(answer: PageAnswer, status: number): void {
    Assert.areEqual(status, answer.status);
    Assert.areEqual(String.empty, answer.body);
    Assert.isUndefined(answer.headers["content-security-policy"]);
    Assert.areEqual("nosniff,no-store", [answer.headers["x-content-type-options"], answer.headers["cache-control"]].join(","));
  }
}
