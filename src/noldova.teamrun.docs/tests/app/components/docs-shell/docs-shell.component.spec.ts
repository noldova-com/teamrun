/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { Router, provideRouter, withComponentInputBinding } from "@angular/router";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { TooltipFixture } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import "@noldova/context.core";

import { releasedVersion } from "@docs-generated/release";

import { routes } from "../../../../src/app/app.routes";
import { DocsShellComponent } from "../../../../src/app/components/docs-shell/docs-shell.component";
import { DocsCatalog } from "../../../../src/app/models/docs-catalog";
import { DocsFixture } from "../../../fixtures/docs.fixture";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture";
import { SamplePageFixture } from "../../../fixtures/sample-page.fixture";
import { ScrolledPage } from "../../../fixtures/scrolled-page";

describe("DocsShellComponent", () => {
  const renderAsync = async (url: string): Promise<ComponentFixture<DocsShellComponent>> => {
    TestBed.configureTestingModule({ providers: [provideRouter([...routes, SamplePageFixture.ROUTE], withComponentInputBinding()), provideMarkdown(), TooltipFixture.atOnce] });
    const fixture = TestBed.createComponent(DocsShellComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture;
  };

  const heading = (fixture: ComponentFixture<DocsShellComponent>): string | undefined =>
    DocsFixture.host(fixture).querySelector("main h1")?.textContent.trim();

  const topOf = (host: HTMLElement): number =>
    Math.max(...["nol-site-header", ".nol-docs-pages-bar"].map(t => DocsFixture.one(host, t).getBoundingClientRect()).filter(t => t.height > 0).map(t => t.bottom));

  const sampleAsync = async (host: HTMLElement): Promise<void> => {
    await DocsFixture.untilAsync(() => expect(DocsFixture.one(host, "main").textContent).toContain("Next steps"));
  };

  afterEach(() => DocsFixture.resetAsync());

  describe.each([
    ["Light", "light", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    ["Dark", "dark", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    ["Light", "light", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT],
    ["Dark", "dark", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT]
  ])("in the %s mode, a %s color scheme, at %ipx wide", (mode, scheme, width, height) => {
    it.each(["/", SamplePageFixture.LINK])("keeps %s inside the page's width", async url => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(url));
      await DocsFixture.untilAsync(() => expect(DocsFixture.all(host, "main .nol-markdown-blocks > *").length).toBeGreaterThan(0));

      const edge = document.documentElement.clientWidth;

      expect(getComputedStyle(document.documentElement).colorScheme).toBe(scheme);
      expect(window.innerWidth).toBe(width);
      expect(DocsFixture.overflowWidth()).toBe(0);
      expect(DocsFixture.one(host, "nol-site-header").getBoundingClientRect().right).toBeLessThanOrEqual(edge);
      expect(DocsFixture.one(host, "main").getBoundingClientRect().right).toBeLessThanOrEqual(edge);
    });
  });

  describe.each([
    [DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT],
    [768, 1024],
    [1024, 768],
    [DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    [1920, 1080],
    [2000, 1125]
  ])("at %ipx wide", (width, height) => {
    it.each(["/chats", "/install", "/privacy", "/provider-features", "/tools", "/troubleshooting"])("fits every table on %s inside the page's text, with no table scrolling sideways from a desktop's width but the 12-column ones on /provider-features below 1920px", async url => {
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(url));
      await DocsFixture.untilAsync(() => expect(DocsFixture.all(host, "main .nol-markdown-table").length).toBeGreaterThan(0));
      const text = DocsFixture.one(host, "main .nol-docs-page-body").getBoundingClientRect();
      const tables = DocsFixture.all(host, "main .nol-markdown-table");

      expect(DocsFixture.overflowWidth()).toBe(0);
      expect(tables.flatMap((t, index) => {
        const box = t.getBoundingClientRect();
        return box.left < text.left - 0.5 || box.right > text.right + 0.5 ? [`table ${index + 1}: ${Math.round(box.width)} > ${Math.round(text.width)}`] : [];
      })).toEqual([]);
      if (width >= DocsFixture.DESKTOP_WIDTH)
        expect(tables.flatMap((t, index) => t.scrollWidth > t.clientWidth ? [`table ${index + 1}`] : []))
          .toEqual(url === "/provider-features" && width < 1920 ? ["table 1", "table 2"] : []);
    });
  });

  describe.each([
    ["Light", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT, 1.5],
    ["Dark", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT, 1.5],
    ["Light", 1920, 1080, 1.5],
    ["Light", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT, 1],
    ["Dark", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT, 1]
  ])("in the %s mode at %i by %i CSS pixels, the site's header and footer", (mode, width, height, inset) => {
    const renderSiteAsync = async (url: string): Promise<HTMLElement> => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      return DocsFixture.host(await renderAsync(url));
    };

    const contentStart = (): number => Math.max(0, (document.documentElement.clientWidth - 108 * DocsFixture.rem()) / 2);

    const linksOf = (root: HTMLElement, selector: string): readonly (readonly (string | null)[])[] =>
      DocsFixture.all(root, selector).map(t => [t.textContent.trim(), t.getAttribute("href"), t.getAttribute("aria-current")]);

    it("are the kit's wide header and footer, with TeamRun's lockup home, its released version, the docs site's links, GitHub, X and Download", async () => {
      const host = await renderSiteAsync("/");
      const header = DocsFixture.one(host, "nol-site-header");
      const footer = DocsFixture.one(host, "nol-site-footer");
      const version = DocsFixture.one(header, ".nol-site-version");

      expect([header.classList.contains("nol-site-header-wide"), footer.classList.contains("nol-site-footer-wide")]).toEqual([true, true]);
      expect([DocsFixture.one(header, ".nol-site-lockup-link").getAttribute("href"), DocsFixture.one(header, ".nol-site-lockup-name").textContent.trim()]).toEqual(["/", "TeamRun"]);
      expect([version.textContent.trim(), version.getAttribute("href")]).toEqual([`v${releasedVersion}`, "/release-notes"]);
      expect(linksOf(header, ".nol-site-nav-link")).toEqual([["TeamRun website", "https://teamrun.noldova.com/", null], ["Release notes", "/release-notes", null]]);
      expect(DocsFixture.all(header, ".nol-site-social").map(t => [t.getAttribute("aria-label"), t.getAttribute("href")]))
        .toEqual([["GitHub", "https://github.com/noldova-com/teamrun"], ["X", "https://x.com/noldova"]]);
      expect(DocsFixture.one(header, ".nol-site-download").getAttribute("href")).toBe("https://teamrun.noldova.com/download/");
      expect([DocsFixture.one(header, ".nol-site-skip").getAttribute("href"), DocsFixture.one(host, "main").id]).toEqual(["#nol-docs-main", "nol-docs-main"]);
      expect(DocsFixture.all(footer, ".nol-site-footer-group").map(t => [t.getAttribute("aria-label"), ...linksOf(t, "a").map(u => `${u[0]} ${u[1]}`)])).toEqual([
        ["TeamRun", "Website https://teamrun.noldova.com/", "Download https://teamrun.noldova.com/download/", "Release notes /release-notes"],
        ["Help", "Feedback & support https://github.com/noldova-com/teamrun/issues", "Privacy https://teamrun.noldova.com/privacy/"],
        ["Follow", "GitHub https://github.com/noldova-com/teamrun", "X https://x.com/noldova"]
      ]);
      expect(footer.querySelector(".nol-site-footer-line")).toBeNull();
    });

    it.each(["/release-notes", "/release-notes/"])("marks the release notes current in the header and the footer on their page at %s", async address => {
      const host = await renderSiteAsync(address);

      expect(linksOf(DocsFixture.one(host, "nol-site-header"), ".nol-site-nav-link").map(t => t[2])).toEqual([null, "page"]);
      expect(linksOf(DocsFixture.one(host, "nol-site-footer"), "a.nol-site-footer-link").filter(t => t[2] === "page").map(t => t[0])).toEqual(["Release notes"]);
    });

    it("lays the header 3.5rem high across the window at its top, its wordmark at the site's inset inside 108rem and its parts centered on its line", async () => {
      const host = await renderSiteAsync("/");
      const rem = DocsFixture.rem();
      const header = DocsFixture.one(host, "nol-site-header");
      const box = header.getBoundingClientRect();
      const edge = document.documentElement.clientWidth;
      const wordmark = DocsFixture.one(header, ".nol-site-header-bar .nol-site-wordmark").getBoundingClientRect();
      const end = DocsFixture.one(header, width === DocsFixture.PHONE_WIDTH ? ".nol-site-menu-button" : ".nol-site-download").getBoundingClientRect();
      const middle = box.top + box.height / 2;

      expect(box.height / rem).toBeCloseTo(3.5, 2);
      expect([box.top, box.left, box.right]).toEqual([0, 0, edge]);
      expect((wordmark.left - contentStart()) / rem).toBeCloseTo(inset, 2);
      expect(Math.abs(wordmark.top + wordmark.height / 2 - middle) / rem).toBeLessThanOrEqual(0.05);
      expect(Math.abs(end.top + end.height / 2 - middle) / rem).toBeLessThanOrEqual(0.05);
      expect(end.right).toBeLessThanOrEqual(edge - contentStart());
      if (width !== DocsFixture.PHONE_WIDTH)
        expect((edge - contentStart() - end.right) / rem).toBeCloseTo(inset, 2);
      expect(DocsFixture.overflowWidth()).toBe(0);
    });

    it("puts the footer under the page across the window, its wordmark under the header's", async () => {
      const host = await renderSiteAsync(SamplePageFixture.LINK);
      await sampleAsync(host);
      const rem = DocsFixture.rem();
      const footer = DocsFixture.one(host, "nol-site-footer").getBoundingClientRect();
      const header = DocsFixture.one(host, "nol-site-header .nol-site-wordmark").getBoundingClientRect();
      const wordmark = DocsFixture.one(host, "nol-site-footer .nol-site-wordmark").getBoundingClientRect();

      expect(footer.top).toBeGreaterThanOrEqual(DocsFixture.one(host, ".nol-docs-body").getBoundingClientRect().bottom - 0.5);
      expect([footer.left, footer.right]).toEqual([0, document.documentElement.clientWidth]);
      expect(Math.abs(wordmark.left - header.left) / rem).toBeLessThanOrEqual(0.01);
      expect(wordmark.width / rem).toBeCloseTo(header.width / rem, 2);
    });
  });

  describe.each(DocsFixture.MODES)("on a desktop in the $mode mode, the site header", ({ mode }) => {
    it("shows the docs search 16rem wide after the links and before GitHub, X, the theme and Download, and reaches a page from it", async () => {
      DocsFixture.setMode(mode);
      const fixture = await renderAsync("/");
      const header = DocsFixture.one(DocsFixture.host(fixture), "nol-site-header");
      const rem = DocsFixture.rem();
      const search = DocsFixture.one(header, "nol-docs-search").getBoundingClientRect();
      const links = DocsFixture.all(header, ".nol-site-nav-link").map(t => t.getBoundingClientRect());
      const social = DocsFixture.one(header, ".nol-site-social").getBoundingClientRect();

      expect(search.width / rem).toBeCloseTo(16, 2);
      expect(search.left).toBeGreaterThanOrEqual(links.at(-1)?.right ?? Number.NaN);
      expect(social.left).toBeGreaterThanOrEqual(search.right);
      expect(DocsFixture.one(header, ".nol-site-search-button").getBoundingClientRect().width).toBe(0);

      await userEvent.fill(DocsFixture.one(header, "input[type=search]"), "acp");
      await userEvent.click(await DocsFixture.untilAsync(() => DocsFixture.byText(header, ".nol-docs-search-result", "ACP agents")));

      await DocsFixture.untilAsync(() => expect(heading(fixture)).toBe("ACP agents"));
    });

    it("saves the kit's theme choice under noldova-theme and applies it to the page", async () => {
      DocsFixture.setMode(mode);
      const other = mode === "Light" ? "Dark" : "Light";
      const header = DocsFixture.one(DocsFixture.host(await renderAsync("/")), "nol-site-header");

      await userEvent.click(DocsFixture.one(header, `nol-site-theme-switch [aria-label="${other}"]`));

      await DocsFixture.untilAsync(() => expect(document.documentElement.getAttribute(DocsFixture.MODE_ATTRIBUTE)).toBe(other));
      expect(localStorage.getItem(DocsFixture.STORAGE_KEY)).toBe(other.toLowerCase());
    });
  });

  it("follows the header's and footer's links to the site's own pages through the router, and leaves other sites' links, new-tab links, the page's own anchors, handled and modified clicks and clicks off a link to the browser", async () => {
    const fixture = await renderAsync("/");
    const host = DocsFixture.host(fixture);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, "navigateByUrl");
    const clickOn = (target: EventTarget, init: MouseEventInit, isPrevented: boolean = false): boolean => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init });
      if (isPrevented)
        target.addEventListener("click", t => t.preventDefault(), { once: true });
      window.addEventListener("click", t => t.preventDefault(), { once: true });
      target.dispatchEvent(event);
      return navigate.mock.calls.length > 0;
    };

    await userEvent.click(DocsFixture.byText(host, "nol-site-footer a", "Release notes"));
    await DocsFixture.routedAsync(router, "/release-notes");
    expect(heading(fixture)).toBe("Release notes");
    await userEvent.click(DocsFixture.one(host, "nol-site-header .nol-site-lockup-link"));
    await DocsFixture.routedAsync(router, "/");
    navigate.mockClear();

    const notes = DocsFixture.byText(host, "nol-site-footer a", "Release notes");
    const newTab = DocsFixture.byText(host, "nol-site-footer a", "Download");
    newTab.setAttribute("target", "_blank");
    const text = document.createTextNode("TeamRun");
    DocsFixture.one(host, "nol-site-footer").append(text);

    expect([
      clickOn(DocsFixture.byText(host, "nol-site-header .nol-site-nav-link", "TeamRun website"), {}),
      clickOn(notes, { ctrlKey: true }),
      clickOn(notes, { metaKey: true }),
      clickOn(notes, { shiftKey: true }),
      clickOn(notes, { altKey: true }),
      clickOn(notes, { button: 1 }),
      clickOn(notes, {}, true),
      clickOn(newTab, {}),
      clickOn(text, {}),
      clickOn(DocsFixture.one(host, "nol-site-footer"), {}),
      clickOn(DocsFixture.one(host, "nol-site-header .nol-site-skip"), {})
    ]).toEqual(Array(11).fill(false));
  });

  describe.each(DocsFixture.MODES)("on a phone in the $mode mode, the site header", ({ mode }) => {
    const phoneAsync = async (): Promise<HTMLElement> => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
      return DocsFixture.host(await renderAsync("/install"));
    };

    it("keeps Download in its menu, across the menu's width, and takes turns with the pages menu", async () => {
      const host = await phoneAsync();
      const rem = DocsFixture.rem();
      const header = DocsFixture.one(host, "nol-site-header");
      const siteButton = DocsFixture.one(header, ".nol-site-menu-button");
      const pagesButton = DocsFixture.one(host, "button.nol-docs-menu-button");
      const download = DocsFixture.one(header, ".nol-site-download");

      expect(download.getBoundingClientRect().width).toBe(0);
      await userEvent.click(pagesButton);
      await DocsFixture.untilAsync(() => expect(pagesButton.getAttribute("aria-expanded")).toBe("true"));

      await userEvent.click(siteButton);
      await DocsFixture.untilAsync(() => expect(siteButton.getAttribute("aria-expanded")).toBe("true"));
      const box = download.getBoundingClientRect();

      expect(pagesButton.getAttribute("aria-expanded")).toBe("false");
      expect(getComputedStyle(DocsFixture.one(host, "#nol-docs-menu")).display).toBe("none");
      expect(box.left / rem).toBeCloseTo(1, 2);
      expect((document.documentElement.clientWidth - box.right) / rem).toBeCloseTo(1, 2);
      expect(box.height / rem).toBeCloseTo(2.75, 2);
      expect(box.bottom).toBeLessThanOrEqual(header.getBoundingClientRect().bottom);

      await userEvent.click(pagesButton);
      await DocsFixture.untilAsync(() => expect(pagesButton.getAttribute("aria-expanded")).toBe("true"));
      expect(siteButton.getAttribute("aria-expanded")).toBe("false");
    });

    it("opens the docs search across the bar from its search button with the focus in its field, and closes it on reaching a page", async () => {
      const host = await phoneAsync();
      const rem = DocsFixture.rem();
      const header = DocsFixture.one(host, "nol-site-header");
      const button = DocsFixture.one(header, ".nol-site-search-button");
      const field = DocsFixture.one(header, "input[type=search]");

      expect(field.getBoundingClientRect().width).toBe(0);
      await userEvent.click(button);
      await DocsFixture.untilAsync(() => expect(document.activeElement).toBe(field));
      const box = DocsFixture.one(header, "nol-docs-search").getBoundingClientRect();

      expect(box.left / rem).toBeCloseTo(1, 2);
      expect((document.documentElement.clientWidth - box.right) / rem).toBeCloseTo(1, 2);
      await userEvent.fill(field, "acp");
      await userEvent.click(await DocsFixture.untilAsync(() => DocsFixture.byText(header, ".nol-docs-search-result", "ACP agents")));

      await DocsFixture.untilAsync(() => expect(button.getAttribute("aria-expanded")).toBe("false"));
      expect(DocsFixture.one(host, "main h1").textContent.trim()).toBe("ACP agents");
    });

    it("keeps the pages bar under the header's open menu on a scrolled page, in front of the page", async () => {
      const host = await phoneAsync();
      const header = DocsFixture.one(host, "nol-site-header");
      const bar = DocsFixture.one(host, ".nol-docs-pages-bar");
      window.scrollTo(0, document.documentElement.scrollHeight / 2);
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(0));

      await userEvent.click(DocsFixture.one(header, ".nol-site-menu-button"));

      await DocsFixture.untilAsync(() => expect(Math.abs(bar.getBoundingClientRect().top - header.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0.5));
      const box = bar.getBoundingClientRect();
      expect(header.getBoundingClientRect().top).toBe(0);
      expect(bar.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
    });

    it("puts the pages bar right under the header, 3.5rem high, its button centered on it with its glyph at the site's 1rem inset", async () => {
      const host = await phoneAsync();
      const rem = DocsFixture.rem();
      const bar = DocsFixture.one(host, ".nol-docs-pages-bar").getBoundingClientRect();
      const button = DocsFixture.one(host, "button.nol-docs-menu-button");
      const box = button.getBoundingClientRect();
      const icon = DocsFixture.one(button, "[nolButtonIcon]").getBoundingClientRect();

      expect(bar.top).toBe(DocsFixture.one(host, "nol-site-header").getBoundingClientRect().bottom);
      expect(bar.height / rem).toBeCloseTo(3.5, 2);
      expect(icon.left / rem).toBeCloseTo(1, 1);
      expect(button.textContent.trim()).toContain("Pages");
      expect(Math.abs(box.top + box.height / 2 - (bar.top + bar.height / 2)) / rem).toBeLessThanOrEqual(0.05);
    });
  });

  it("puts the menu beside the page on a desktop, with no menu button, and behind a closed menu button on a phone", async () => {
    const host = DocsFixture.host(await renderAsync("/"));
    const menu = DocsFixture.one(host, "#nol-docs-menu");
    const main = DocsFixture.one(host, "main");
    const button = DocsFixture.one(host, "button.nol-docs-menu-button");

    expect(menu.getBoundingClientRect().right).toBeLessThanOrEqual(main.getBoundingClientRect().left);
    expect(getComputedStyle(DocsFixture.one(host, "nol-docs-pages-bar")).display).toBe("none");
    expect(button.getBoundingClientRect().width).toBe(0);

    await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
    await DocsFixture.untilAsync(() => expect(getComputedStyle(menu).display).toBe("none"));
    expect(button.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(menu.id);
  });

  describe("the menu", () => {
    it("lists every page of the catalog once, in its order, under the Start, Using TeamRun and Reference groups", async () => {
      const nav = DocsFixture.one(DocsFixture.host(await renderAsync("/")), "#nol-docs-menu");
      const lists = DocsFixture.all(nav, ".nol-docs-menu-list");

      expect(DocsFixture.all(nav, "nol-section-header").map(t => t.textContent.trim())).toEqual(["Start", "Using TeamRun", "Reference"]);
      expect(lists.map(t => DocsFixture.all(t, "a").map(u => u.textContent.trim()))).toEqual([
        ["TeamRun", "Getting started", "Install"],
        ["Providers and sign-in", "What each provider can do", "ACP agents", "Chats and teammates", "Following and approving the work", "Organization", "Projects and folders",
          "Tools teammates use", "When usage runs out", "Settings"],
        ["Privacy and network", "Troubleshooting", "FAQ", "Release notes"]
      ]);
      expect(DocsFixture.all(nav, "a").map(t => t.getAttribute("href"))).toEqual(DocsCatalog.pages.map(t => t.link));
      expect(DocsFixture.all(nav, ":scope > a")).toEqual([]);
    });

    it("puts the kit's 12px space above each of the menu's group headers after the first, beside the menu's 4px gap on a desktop", async () => {
      await DocsFixture.viewAsync(DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT);
      const headers = DocsFixture.all(DocsFixture.host(await renderAsync("/")), "#nol-docs-menu nol-section-header");
      const margin = (element: HTMLElement): number => Number.parseFloat(getComputedStyle(element).marginTop);

      expect(headers.map(t => margin(t))).toEqual([0, 12, 12]);
      expect(headers.map(t => Object.isNull(t.previousElementSibling))).toEqual([true, false, false]);
      expect(headers.slice(1).map(t => t.getBoundingClientRect().top - (t.previousElementSibling?.getBoundingClientRect().bottom ?? Number.NaN)))
        .toEqual([expect.closeTo(16, 1), expect.closeTo(16, 1)]);
    });

    it.each(DocsCatalog.pages.map(t => [t.link, t.title]))("marks only %s's link current on its page, and shows its title as the page's heading", async (link, title) => {
      const fixture = await renderAsync(link);
      const nav = DocsFixture.one(DocsFixture.host(fixture), "#nol-docs-menu");

      expect(DocsFixture.all(nav, "[aria-current=page]").map(t => t.textContent.trim())).toEqual([title]);
      expect(DocsFixture.all(nav, ".nol-docs-menu-current").map(t => t.textContent.trim())).toEqual([title]);
      expect(heading(fixture)).toBe(title);
    });

    it("reaches the Install page from its menu group and moves the current mark to it", async () => {
      const fixture = await renderAsync("/");
      const nav = DocsFixture.one(DocsFixture.host(fixture), "#nol-docs-menu");

      await userEvent.click(DocsFixture.byText(nav, "a", "Install"));

      await DocsFixture.untilAsync(() => expect(heading(fixture)).toBe("Install"));
      expect(DocsFixture.byText(nav, "a", "Install").getAttribute("aria-current")).toBe("page");
      expect(DocsFixture.byText(nav, "a", "TeamRun").getAttribute("aria-current")).toBeNull();
    });

    describe.each(DocsFixture.MODES)("in the $mode mode", ({ mode }) => {
      it("starts each link's text at the same edge, a rem-measured inset from the menu's, and fills the current one inside the menu", async () => {
        DocsFixture.setMode(mode);
        const nav = DocsFixture.one(DocsFixture.host(await renderAsync("/install")), "#nol-docs-menu");
        const rem = DocsFixture.rem();
        const navBox = nav.getBoundingClientRect();
        const starts = DocsFixture.all(nav, ".nol-docs-menu-link").map(t => {
          const range = document.createRange();
          range.selectNodeContents(t);
          return range.getBoundingClientRect().left;
        });
        const current = DocsFixture.byText(nav, "a", "Install");
        const box = current.getBoundingClientRect();

        expect(new Set(starts.map(t => Math.round((t - navBox.left) / rem * 100) / 100)).size).toBe(1);
        expect(box.left).toBeGreaterThanOrEqual(navBox.left);
        expect(box.right).toBeLessThanOrEqual(navBox.right);
        expect(getComputedStyle(current).backgroundColor).not.toBe(getComputedStyle(DocsFixture.byText(nav, "a", "Settings")).backgroundColor);
      });
    });
  });

  describe.each([
    ["Light", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    ["Dark", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    ["Light", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT],
    ["Dark", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT]
  ])("in the %s mode at %ipx wide, while the page scrolls", (mode, width, height) => {
    const scrolledAsync = async (): Promise<ScrolledPage> => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
      const header = DocsFixture.one(host, "nol-site-header");
      await sampleAsync(host);
      const before = header.getBoundingClientRect().height;
      window.scrollTo(0, document.documentElement.scrollHeight / 2);
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(before));
      return new ScrolledPage(host, header, before);
    };

    it("keeps the header at the top of the window, at its height and in front of the page", async () => {
      const { header, headerHeight: before } = await scrolledAsync();
      const box = header.getBoundingClientRect();

      expect(box.top).toBe(0);
      expect(box.height).toBeCloseTo(before, 1);
      expect(getComputedStyle(header).backgroundColor).toMatch(/^rgb\(/u);
      expect(header.contains(document.elementFromPoint(box.left + box.width / 2, box.bottom - 1))).toBe(true);
      expect(header.contains(document.elementFromPoint(box.left + 1, box.top + 1))).toBe(true);
    });

    it("keeps the menu right below the header, in front of the page and in the window wherever the page is scrolled, scrolling on its own in a window too short for it", async () => {
      const { host } = await scrolledAsync();
      const menu = DocsFixture.one(host, "#nol-docs-menu");
      if (width === DocsFixture.PHONE_WIDTH) {
        await userEvent.click(DocsFixture.one(host, "button.nol-docs-menu-button"));
        await DocsFixture.untilAsync(() => expect(menu.getBoundingClientRect().height).toBeGreaterThan(0));
      }
      const expectInView = (): void => {
        const box = menu.getBoundingClientRect();

        expect(Math.abs(box.top - topOf(host))).toBeLessThanOrEqual(0.5);
        expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
        expect(menu.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
      };

      expectInView();
      const scrolled = window.scrollY;
      window.scrollTo(0, scrolled + window.innerHeight / 2);
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(scrolled));
      expectInView();
      await DocsFixture.viewAsync(width, DocsFixture.SHORT_HEIGHT);
      await DocsFixture.untilAsync(() => expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight));
      expectInView();
      menu.scrollTop = menu.scrollHeight;

      expect(menu.scrollTop).toBeGreaterThan(0);
    });

    it("lands a heading an address names fully below the header", async () => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(`${SamplePageFixture.LINK}#your-first-chat`));
      const header = DocsFixture.one(host, "nol-site-header");
      await sampleAsync(host);

      await DocsFixture.untilAsync(() => {
        const target = DocsFixture.one(host, "#your-first-chat");
        expect(window.scrollY).toBeGreaterThan(0);
        expect(Math.abs(target.getBoundingClientRect().top - topOf(host))).toBeLessThanOrEqual(1);
      });
      expect(header.getBoundingClientRect().top).toBe(0);
    });
  });

  it("sets the root's header height as it first renders, before a frame lets the header's size be observed", () => {
    const root = document.documentElement;
    root.style.removeProperty("--nol-docs-header-height");
    TestBed.configureTestingModule({ providers: [provideRouter(routes, withComponentInputBinding()), provideMarkdown(), TooltipFixture.atOnce] });
    const fixture = TestBed.createComponent(DocsShellComponent);
    fixture.detectChanges();
    const host = DocsFixture.host(fixture);
    const height = DocsFixture.one(host, "nol-site-header").getBoundingClientRect().height + DocsFixture.one(host, ".nol-docs-pages-bar").getBoundingClientRect().height;

    expect(root.style.getPropertyValue("--nol-docs-header-height")).toBe(`${height}px`);
  });

  it("takes the header height off the root when it goes", async () => {
    const fixture = await renderAsync("/");
    const root = document.documentElement;
    await DocsFixture.untilAsync(() => expect(root.style.getPropertyValue("--nol-docs-header-height")).not.toBe(String()));

    fixture.destroy();

    expect(root.style.getPropertyValue("--nol-docs-header-height")).toBe(String());
  });

  describe("under forced colors", () => {
    afterEach(() => ForcedColorsFixture.resetAsync());

    it("keeps the header at the top and in front of the page, filled with the window's ground", async () => {
      await ForcedColorsFixture.activateAsync();
      const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
      const header = DocsFixture.one(host, "nol-site-header");
      await sampleAsync(host);
      window.scrollTo(0, document.documentElement.scrollHeight / 2);
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(0));
      const box = header.getBoundingClientRect();

      expect(box.top).toBe(0);
      expect(getComputedStyle(header).backgroundColor).toBe(ForcedColorsFixture.resolve("Canvas"));
      expect(header.contains(document.elementFromPoint(box.left + box.width / 2, box.bottom - 1))).toBe(true);
    });

    const expectCurrentMarkedAsync = async (nav: HTMLElement): Promise<void> => {
      const current = DocsFixture.byText(nav, "a", "Install");
      const other = DocsFixture.byText(nav, "a", "Getting started");
      const box = current.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();

      expect(current.getAttribute("aria-current")).toBe("page");
      expect(getComputedStyle(current).backgroundColor).toBe(ForcedColorsFixture.resolve("Highlight"));
      expect(getComputedStyle(current).color).toBe(ForcedColorsFixture.resolve("HighlightText"));
      expect(getComputedStyle(other).backgroundColor).not.toBe(ForcedColorsFixture.resolve("Highlight"));
      expect(getComputedStyle(other).color).not.toBe(ForcedColorsFixture.resolve("HighlightText"));
      expect(box.width).toBe(other.getBoundingClientRect().width);
      expect(box.left).toBeGreaterThanOrEqual(navBox.left);
      expect(box.right).toBeLessThanOrEqual(navBox.right);
      expect(current.contains(document.elementFromPoint(box.left + 1, box.top + box.height / 2))).toBe(true);

      await userEvent.keyboard("{Shift}");
      current.focus();
      await DocsFixture.untilAsync(() => expect(current.matches(":focus-visible")).toBe(true));
      expect(getComputedStyle(current).outlineColor).toBe(ForcedColorsFixture.resolve("HighlightText"));
      expect(getComputedStyle(current).outlineStyle).toBe("solid");

      await userEvent.hover(current);
      await DocsFixture.untilAsync(() => expect(current.matches(":hover")).toBe(true));
      expect(getComputedStyle(current).backgroundColor).toBe(ForcedColorsFixture.resolve("Highlight"));
      expect(getComputedStyle(current).color).toBe(ForcedColorsFixture.resolve("HighlightText"));
    };

    describe.each(DocsFixture.MODES)("in the $mode mode", ({ mode }) => {
      it("marks the menu's current page with the highlight fill and its text on a desktop, through hover and focus", async () => {
        DocsFixture.setMode(mode);
        await ForcedColorsFixture.activateAsync();
        const nav = DocsFixture.one(DocsFixture.host(await renderAsync("/install")), "#nol-docs-menu");
        await DocsFixture.untilAsync(() => expect(getComputedStyle(nav).display).toBe("grid"));

        await expectCurrentMarkedAsync(nav);
      });

      it("marks the current page the same way in the phone menu", async () => {
        DocsFixture.setMode(mode);
        await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
        await ForcedColorsFixture.activateAsync();
        const host = DocsFixture.host(await renderAsync("/install"));
        const nav = DocsFixture.one(host, "#nol-docs-menu");
        const button = DocsFixture.one(host, "button.nol-docs-menu-button");

        button.focus();
        await userEvent.keyboard("{Enter}");
        await DocsFixture.untilAsync(() => expect(getComputedStyle(nav).display).toBe("grid"));

        await expectCurrentMarkedAsync(nav);
      });
    });
  });

  describe.each(DocsFixture.MODES)("on a phone in the $mode mode, a $scheme color scheme", ({ mode, scheme }) => {
    it("starts the page's content right under the header, and opens the menu above it from the menu button", async () => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
      const host = DocsFixture.host(await renderAsync("/install"));
      const header = DocsFixture.one(host, "nol-site-header");
      const menu = DocsFixture.one(host, "#nol-docs-menu");
      const main = DocsFixture.one(host, "main");
      const button = DocsFixture.one(host, "button.nol-docs-menu-button");

      expect(getComputedStyle(document.documentElement).colorScheme).toBe(scheme);
      expect(main.getBoundingClientRect().top).toBe(topOf(host));
      expect(DocsFixture.one(host, ".nol-docs-pages-bar").getBoundingClientRect().top).toBe(header.getBoundingClientRect().bottom);
      expect(DocsFixture.one(main, "h1").getBoundingClientRect().bottom).toBeLessThanOrEqual(DocsFixture.PHONE_HEIGHT / 2);
      expect(button.getBoundingClientRect().left).toBeGreaterThanOrEqual(header.getBoundingClientRect().left);

      await userEvent.click(button);
      await DocsFixture.untilAsync(() => expect(button.getAttribute("aria-expanded")).toBe("true"));
      expect(menu.getBoundingClientRect().top).toBe(topOf(host));
      expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(main.getBoundingClientRect().top);
      expect(DocsFixture.overflowWidth()).toBe(0);

      await userEvent.click(button);
      await DocsFixture.untilAsync(() => expect(getComputedStyle(menu).display).toBe("none"));
      expect(button.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("opens and closes the menu from the keyboard, and Escape closes it with the focus back on its button", async () => {
    await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
    const host = DocsFixture.host(await renderAsync("/"));
    const menu = DocsFixture.one(host, "#nol-docs-menu");
    const button = DocsFixture.one(host, "button.nol-docs-menu-button");

    button.focus();
    await userEvent.keyboard("{Enter}");
    await DocsFixture.untilAsync(() => expect(button.getAttribute("aria-expanded")).toBe("true"));
    await userEvent.keyboard(" ");
    await DocsFixture.untilAsync(() => expect(button.getAttribute("aria-expanded")).toBe("false"));

    await userEvent.keyboard("{Enter}");
    await DocsFixture.untilAsync(() => expect(getComputedStyle(menu).display).toBe("grid"));
    DocsFixture.byText(menu, "a", "Install").focus();
    await userEvent.keyboard("{Escape}");

    await DocsFixture.untilAsync(() => expect(button.getAttribute("aria-expanded")).toBe("false"));
    expect(document.activeElement).toBe(button);
  });

  it.each([["another page", "Install"], ["the page already shown", "TeamRun"]])(
    "closes the menu and moves the focus to the page's heading when a phone reader chooses %s", async (_case, title) => {
      await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
      const host = DocsFixture.host(await renderAsync("/"));
      const menu = DocsFixture.one(host, "#nol-docs-menu");
      const button = DocsFixture.one(host, "button.nol-docs-menu-button");

      await userEvent.click(button);
      await DocsFixture.untilAsync(() => expect(getComputedStyle(menu).display).toBe("grid"));
      await userEvent.click(DocsFixture.byText(menu, "a", title));

      await DocsFixture.untilAsync(() => expect(document.activeElement?.tagName).toBe("H1"));
      expect(document.activeElement?.textContent?.trim()).toBe(title);
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(getComputedStyle(menu).display).toBe("none");
    });

  it("leaves the focus on a desktop menu's link the reader chose", async () => {
    const fixture = await renderAsync("/");
    const link = DocsFixture.byText(DocsFixture.one(DocsFixture.host(fixture), "#nol-docs-menu"), "a", "Install");

    await userEvent.click(link);
    await DocsFixture.untilAsync(() => expect(heading(fixture)).toBe("Install"));

    expect(document.activeElement).toBe(link);
  });

  it("reaches a page from a search for its title", async () => {
    const fixture = await renderAsync("/");
    const host = DocsFixture.host(fixture);

    await userEvent.fill(DocsFixture.one(host, "input[type=search]"), "acp");
    await DocsFixture.untilAsync(() => expect(DocsFixture.all(host, ".nol-docs-search-result").map(t => t.textContent.trim())).toEqual(["ACP agents"]));
    await userEvent.click(DocsFixture.byText(host, ".nol-docs-search-result", "ACP agents"));

    await DocsFixture.untilAsync(() => expect(heading(fixture)).toBe("ACP agents"));
    expect(host.querySelector(".nol-docs-search-results")).toBeNull();
  });

  it("shows the TeamRun page at the site's root", async () => {
    expect(heading(await renderAsync("/"))).toBe("TeamRun");
  });

  describe.each([
    ["Light", 1920, 1080, "a 1920 by 1080 window, wider than the 108rem layout"],
    ["Dark", 1920, 1080, "a 1920 by 1080 window, wider than the 108rem layout"],
    ["Light", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT, "a 1280 by 800 window"],
    ["Dark", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT, "a 1280 by 800 window"],
    ["Light", DocsFixture.DESKTOP_WIDTH / 2, DocsFixture.DESKTOP_HEIGHT / 2, "that window at 200% zoom"],
    ["Dark", DocsFixture.DESKTOP_WIDTH / 2, DocsFixture.DESKTOP_HEIGHT / 2, "that window at 200% zoom"]
  ])("in the %s mode at %i by %i CSS pixels, %s", (mode, width, height) => {
    const pageAsync = async (): Promise<HTMLElement> => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
      await sampleAsync(host);
      return host;
    };

    const resolve = (host: HTMLElement, property: string, value: string): string => {
      const probe = host.appendChild(document.createElement("span"));
      probe.style.setProperty(property, value);
      const resolved = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return resolved;
    };

    it("draws the site's text at the kit's panel size, its paragraphs' lines one and a half times as tall, and its page title at the kit's heading size", async () => {
      const host = await pageAsync();
      const text = DocsFixture.one(host, "main .nol-markdown-blocks p.nol-markdown-paragraph");
      const size = (element: HTMLElement): string => getComputedStyle(element).fontSize;

      expect([size(text), size(DocsFixture.one(host, ".nol-docs-menu-link")), size(DocsFixture.one(host, ".nol-docs-search-field"))]).toEqual(Array(3).fill(resolve(host, "font-size", "var(--nol-text-panel)")));
      expect(Number.parseFloat(getComputedStyle(text).lineHeight)).toBeCloseTo(Number.parseFloat(size(text)) * 1.5, 2);
      expect(size(DocsFixture.one(host, "main h1"))).toBe(resolve(host, "font-size", "var(--nol-text-heading)"));
    });

    it("keeps the header at the window's top and the menu right below it, in front of the page and in the window, wherever the page is scrolled", async () => {
      const host = await pageAsync();
      const header = DocsFixture.one(host, "nol-site-header");
      const menu = DocsFixture.one(host, "#nol-docs-menu");
      const button = DocsFixture.one(host, "button.nol-docs-menu-button");
      if (button.getBoundingClientRect().width > 0) {
        await userEvent.click(button);
        await DocsFixture.untilAsync(() => expect(menu.getBoundingClientRect().height).toBeGreaterThan(0));
      }
      const expectInView = (): void => {
        const box = menu.getBoundingClientRect();

        expect(header.getBoundingClientRect().top).toBe(0);
        expect(Math.abs(box.top - topOf(host))).toBeLessThanOrEqual(0.5);
        expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
        expect(menu.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
      };

      expectInView();
      const end = DocsFixture.one(host, ".nol-docs-body").getBoundingClientRect().bottom - window.innerHeight;
      window.scrollTo(0, Math.min(document.documentElement.scrollHeight / 2, end));
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(0));
      expectInView();
    });

    it("lays the menu, the page and the list across at most 108rem centered in the window, 0.5rem in from its sides from 48rem wide, the page filling the space between them", async () => {
      const host = await pageAsync();
      const rem = DocsFixture.rem();
      const body = DocsFixture.one(host, ".nol-docs-body");
      const box = body.getBoundingClientRect();
      const style = getComputedStyle(body);
      const main = DocsFixture.one(host, "main");
      const mainBox = main.getBoundingClientRect();
      const mainStyle = getComputedStyle(main);
      const page = DocsFixture.one(host, ".nol-docs-page").getBoundingClientRect();
      const inset = width >= 48 * rem ? 0.5 : 0;

      expect(box.width / rem).toBeLessThanOrEqual(108 + 0.01);
      expect(Math.abs(box.left - (document.documentElement.clientWidth - box.right)) / rem).toBeLessThanOrEqual(0.01);
      expect([Number.parseFloat(style.paddingInlineStart) / rem, Number.parseFloat(style.paddingInlineEnd) / rem]).toEqual([inset, inset]);
      expect(Math.abs(page.left - mainBox.left - Number.parseFloat(mainStyle.paddingInlineStart)) / rem).toBeLessThanOrEqual(0.01);
      expect(Math.abs(mainBox.right - Number.parseFloat(mainStyle.paddingInlineEnd) - page.right) / rem).toBeLessThanOrEqual(0.01);
      expect(DocsFixture.overflowWidth()).toBe(0);
    });
  });

  describe.each([
    ["Light", 1920, 1080],
    ["Dark", 1920, 1080],
    ["Light", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    ["Dark", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT]
  ])("on a desktop in the %s mode at %i by %i CSS pixels", (mode, width, height) => {
    const deskAsync = async (): Promise<HTMLElement> => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
      await DocsFixture.untilAsync(() => expect(host.querySelectorAll(".nol-docs-outline-link").length).toBeGreaterThan(0));
      return host;
    };

    it("starts the header's wordmark and the footer's where the menu's text starts, and ends the header's Download button where the list's links end", async () => {
      const host = await deskAsync();
      const rem = DocsFixture.rem();
      const range = document.createRange();
      range.selectNodeContents(DocsFixture.one(host, ".nol-docs-menu-link"));
      const menuText = range.getBoundingClientRect().left;
      const list = DocsFixture.one(host, ".nol-docs-outline-list");
      const download = DocsFixture.one(host, "nol-site-header .nol-site-download").getBoundingClientRect();

      expect(Math.abs(DocsFixture.one(host, "nol-site-header .nol-site-wordmark").getBoundingClientRect().left - menuText) / rem).toBeLessThanOrEqual(0.01);
      expect(Math.abs(DocsFixture.one(host, "nol-site-footer .nol-site-wordmark").getBoundingClientRect().left - menuText) / rem).toBeLessThanOrEqual(0.01);
      expect(Math.abs(download.right - list.getBoundingClientRect().right) / rem).toBeLessThanOrEqual(0.01);
    });

    it("scrolls the menu and the list on their own, keeping the list's heading in view and both inside the window", async () => {
      const host = await deskAsync();
      const menu = DocsFixture.one(host, ".nol-docs-menu");
      const list = DocsFixture.one(host, ".nol-docs-outline-list");
      const title = DocsFixture.one(host, ".nol-docs-outline-title");

      expect([getComputedStyle(menu).overflowY, getComputedStyle(list).overflowY]).toEqual(["auto", "auto"]);
      expect(list.contains(title)).toBe(false);
      expect([menu.getBoundingClientRect().bottom <= window.innerHeight, DocsFixture.one(host, "nol-docs-on-this-page").getBoundingClientRect().bottom <= window.innerHeight]).toEqual([true, true]);
    });
  });
});
