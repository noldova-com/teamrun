/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { type Route, Router, provideRouter, withComponentInputBinding } from "@angular/router";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { userEvent } from "vitest/browser";

import "@noldova/context.core";

import { routes } from "../../../../src/app/app.routes";
import { DocsShellComponent } from "../../../../src/app/components/docs-shell/docs-shell.component";
import { DocsCatalog } from "../../../../src/app/models/docs-catalog";
import { DocsPage } from "../../../../src/app/models/docs-page";
import { DocsFixture } from "../../../fixtures/docs.fixture";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture";
import { SamplePageFixture } from "../../../fixtures/sample-page.fixture";

describe("DocsOnThisPageComponent", () => {
  const headings = ".nol-docs-page-body .nol-markdown-heading[role=heading]";

  const renderAsync = async (url: string, extra: Route = SamplePageFixture.ROUTE): Promise<ComponentFixture<DocsShellComponent>> => {
    window.scrollTo(0, 0);
    TestBed.configureTestingModule({ providers: [provideRouter([...routes, extra], withComponentInputBinding()), provideMarkdown()] });
    const fixture = TestBed.createComponent(DocsShellComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture;
  };

  const links = (host: HTMLElement): readonly HTMLElement[] => DocsFixture.all(host, "nav[aria-labelledby=\"nol-docs-outline-title\"] a");

  const titles = (host: HTMLElement): readonly string[] => links(host).map(t => t.textContent.trim());

  const addressOf = (link: HTMLElement): URL => new URL(link.getAttribute("href") ?? String(), document.baseURI);

  const targetOf = (link: HTMLElement): HTMLElement => DocsFixture.one(document, addressOf(link).hash);

  const settledAsync = async (host: HTMLElement): Promise<void> => {
    await DocsFixture.untilAsync(() => expect(titles(host)).toEqual(SamplePageFixture.titles()));
  };

  const depthOf = (link: HTMLElement): number => link.classList.contains("nol-docs-outline-nested") ? 1 : 0;

  const textStart = (link: HTMLElement): number => {
    const range = document.createRange();
    range.selectNodeContents(link);
    return range.getBoundingClientRect().left;
  };

  const headerBottom = (host: HTMLElement): number => DocsFixture.one(host, ".nol-docs-header").getBoundingClientRect().bottom;

  const current = (host: HTMLElement): readonly string[] => links(host).filter(t => t.getAttribute("aria-current") === "location").map(t => t.textContent.trim());

  afterEach(async () => {
    await ForcedColorsFixture.resetAsync();
    await DocsFixture.resetAsync();
  });

  it("lists a page's second- and third-level Markdown headings in order under its label, each linking to its heading on the page", async () => {
    const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
    await settledAsync(host);
    const nav = DocsFixture.one(host, "nav[aria-labelledby=\"nol-docs-outline-title\"]");

    expect(DocsFixture.one(nav, "#nol-docs-outline-title").textContent.trim()).toBe("On this page");
    expect(links(host).map(t => targetOf(t).textContent.trim())).toEqual(SamplePageFixture.titles());
    expect(links(host).map(t => targetOf(t).getAttribute("aria-level"))).toEqual(SamplePageFixture.depths().map(t => String(t + 2)));
    expect(links(host).map(depthOf)).toEqual(SamplePageFixture.depths());
    expect(links(host).every(t => addressOf(t).pathname.startsWith(SamplePageFixture.LINK))).toBe(true);
  });

  it("starts every section's text at one edge and every nested entry's at one edge further in, all inside the list", async () => {
    const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
    await settledAsync(host);
    const rem = DocsFixture.rem();
    const list = DocsFixture.one(host, ".nol-docs-outline-list").getBoundingClientRect();
    const sections = links(host).filter(t => depthOf(t) === 0).map(textStart);
    const nested = links(host).filter(t => depthOf(t) === 1).map(textStart);
    const [section = Number.NaN] = sections;
    const [inner = Number.NaN] = nested;

    expect(sections.map(t => Math.abs(t - section) / rem)).toEqual(sections.map(() => expect.closeTo(0, 2)));
    expect(nested.map(t => Math.abs(t - inner) / rem)).toEqual(nested.map(() => expect.closeTo(0, 2)));
    expect((inner - section) / rem).toBeGreaterThan(0.25);
    for (const link of links(host)) {
      expect(link.getBoundingClientRect().left).toBeGreaterThanOrEqual(list.left);
      expect(link.getBoundingClientRect().right).toBeLessThanOrEqual(list.right + 0.5);
    }
  });

  it("lists exactly the second- and third-level headings of every page the menu links, and shows no list for a page with none", async () => {
    const host = DocsFixture.host(await renderAsync("/"));

    for (const page of DocsCatalog.menuGroups.flatMap(t => t.pages)) {
      await TestBed.inject(Router).navigateByUrl(page.link);
      await DocsFixture.untilAsync(() => {
        const main = DocsFixture.one(host, "main");
        expect(DocsFixture.one(main, "h1").textContent.trim()).toBe(page.title);
        expect(DocsFixture.all(main, ".nol-docs-page-body .nol-markdown-blocks > *").length).toBeGreaterThan(0);
        const own = DocsFixture.all(main, `${headings}[aria-level="2"], ${headings}[aria-level="3"]`);
        expect(titles(host)).toEqual(own.map(t => t.textContent.trim()));
        expect(Object.isNull(host.querySelector("nav[aria-labelledby=\"nol-docs-outline-title\"]"))).toBe(own.length === 0);
      });
    }
  });

  it("leaves out the page's title and any heading deeper than the third level", async () => {
    const text = `${SamplePageFixture.TEXT}\n\n#### Fine print\n\n${SamplePageFixture.PARAGRAPH}`;
    const page = new DocsPage(SamplePageFixture.TITLE, "deep", SamplePageFixture.PAGE.group, "deep", text);
    const host = DocsFixture.host(await renderAsync("/deep", { ...SamplePageFixture.ROUTE, path: "deep", data: { page } }));
    await DocsFixture.untilAsync(() => expect(DocsFixture.all(host, headings).map(t => t.textContent.trim())).toContain("Fine print"));

    await settledAsync(host);
    expect(titles(host)).not.toContain(SamplePageFixture.TITLE);
  });

  it("scrolls the section a link names to just below the header, puts its anchor in the address and marks it, and does so again for the same link", async () => {
    const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
    await settledAsync(host);
    const link = DocsFixture.byText(host, ".nol-docs-outline-link", "Your first chat");
    const target = targetOf(link);

    await userEvent.click(link);
    await DocsFixture.untilAsync(() => {
      expect(Math.abs(target.getBoundingClientRect().top - headerBottom(host))).toBeLessThanOrEqual(1);
      expect(current(host)).toEqual(["Your first chat"]);
    });
    expect(TestBed.inject(Router).url).toBe(`${SamplePageFixture.LINK}#${target.id}`);

    window.scrollTo(0, 0);
    await DocsFixture.untilAsync(() => expect(current(host)).toEqual([]));
    await userEvent.click(link);
    await DocsFixture.untilAsync(() => expect(Math.abs(target.getBoundingClientRect().top - headerBottom(host))).toBeLessThanOrEqual(1));
  });

  it("lands on the section an address's anchor names, just below the header, and keeps it there as the page above it grows", async () => {
    const host = DocsFixture.host(await renderAsync(`${SamplePageFixture.LINK}#your-first-chat`));
    await settledAsync(host);
    const target = DocsFixture.one(host, "#your-first-chat");
    expect(document.documentElement.scrollHeight - target.getBoundingClientRect().top - window.scrollY).toBeGreaterThanOrEqual(window.innerHeight);

    await DocsFixture.untilAsync(() => expect(Math.abs(target.getBoundingClientRect().top - headerBottom(host))).toBeLessThanOrEqual(1));
    expect(window.scrollY).toBeGreaterThan(0);

    DocsFixture.one(host, "main h1").style.paddingBlockStart = "20rem";
    await DocsFixture.untilAsync(() => expect(Math.abs(target.getBoundingClientRect().top - headerBottom(host))).toBeLessThanOrEqual(1));
  });

  it("marks the section being read as the page scrolls, and the last one in view at the page's end", async () => {
    const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
    await settledAsync(host);
    const section = targetOf(DocsFixture.byText(host, ".nol-docs-outline-link", "Your first chat"));

    expect(current(host)).toEqual([]);
    window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY);
    await DocsFixture.untilAsync(() => expect(current(host)).toEqual(["Your first chat"]));

    window.scrollTo(0, document.documentElement.scrollHeight);
    await DocsFixture.untilAsync(() => expect(current(host)).toEqual(["Next steps"]));
  });

  it("marks the section being read in Highlight under forced colors, and the others in the link color", async () => {
    await ForcedColorsFixture.activateAsync();
    const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
    await settledAsync(host);
    window.scrollTo(0, targetOf(DocsFixture.byText(host, ".nol-docs-outline-link", "Your first chat")).getBoundingClientRect().top + window.scrollY);
    await DocsFixture.untilAsync(() => expect(current(host)).toEqual(["Your first chat"]));
    const marks = links(host).map(t => [t.textContent.trim(), getComputedStyle(t).borderInlineStartColor] as const);

    expect(marks.filter(([title]) => title === "Your first chat").map(([, color]) => color)).toEqual([ForcedColorsFixture.resolve("Highlight")]);
    expect(new Set(marks.filter(([title]) => title !== "Your first chat").map(([, color]) => color))).toEqual(new Set([ForcedColorsFixture.resolve("LinkText")]));
  });

  it("stops holding a reached section once the reader scrolls", async () => {
    const host = DocsFixture.host(await renderAsync(`${SamplePageFixture.LINK}#your-first-chat`));
    await settledAsync(host);
    const target = DocsFixture.one(host, "#your-first-chat");
    expect(document.documentElement.scrollHeight - target.getBoundingClientRect().top - window.scrollY).toBeGreaterThanOrEqual(window.innerHeight);
    await DocsFixture.untilAsync(() => expect(Math.abs(target.getBoundingClientRect().top - headerBottom(host))).toBeLessThanOrEqual(1));

    document.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    window.scrollTo(0, 0);
    DocsFixture.one(host, "main h1").append(document.createTextNode(" "));

    await DocsFixture.untilAsync(() => expect(current(host)).toEqual([]));
    expect(window.scrollY).toBe(0);
  });

  describe.each(DocsFixture.MODES)("in the $mode mode, a $scheme color scheme", ({ mode, scheme }) => {
    it("stands 14rem wide to the right of the page at a desktop width, its title at its padding's edge inside the window, and is hidden at a phone width", async () => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(1920, 1080);
      const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
      await settledAsync(host);
      const rem = DocsFixture.rem();
      const outline = DocsFixture.one(host, "nol-docs-on-this-page");
      const main = DocsFixture.one(host, "main");
      const box = outline.getBoundingClientRect();
      const style = getComputedStyle(outline);
      const title = DocsFixture.one(outline, ".nol-docs-outline-title").getBoundingClientRect();

      expect(getComputedStyle(document.documentElement).colorScheme).toBe(scheme);
      expect(box.left).toBeGreaterThanOrEqual(main.getBoundingClientRect().right);
      expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
      expect(box.width / rem).toBeCloseTo(14, 2);
      expect((title.left - box.left - Number.parseFloat(style.paddingInlineStart)) / rem).toBeCloseTo(0, 2);
      expect((title.top - box.top - Number.parseFloat(style.paddingBlockStart)) / rem).toBeCloseTo(0, 2);
      expect(DocsFixture.overflowWidth()).toBe(0);

      await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
      await DocsFixture.untilAsync(() => expect(getComputedStyle(outline).display).toBe("none"));
      expect(main.getBoundingClientRect().right).toBe(document.documentElement.clientWidth);
      expect(DocsFixture.overflowWidth()).toBe(0);
    });
  });
});
