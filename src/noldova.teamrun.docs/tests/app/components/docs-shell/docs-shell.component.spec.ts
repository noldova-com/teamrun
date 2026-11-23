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

import { routes } from "../../../../src/app/app.routes";
import { DocsShellComponent } from "../../../../src/app/components/docs-shell/docs-shell.component";
import { DocsCatalog } from "../../../../src/app/models/docs-catalog";
import { DocsFixture } from "../../../fixtures/docs.fixture";
import { ForcedColorsFixture } from "../../../fixtures/forced-colors.fixture";
import { SamplePageFixture } from "../../../fixtures/sample-page.fixture";

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
      expect(DocsFixture.one(host, ".nol-docs-header").getBoundingClientRect().right).toBeLessThanOrEqual(edge);
      expect(DocsFixture.one(host, "main").getBoundingClientRect().right).toBeLessThanOrEqual(edge);
    });
  });

  describe.each([
    ["Light", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    ["Dark", DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT],
    ["Light", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT],
    ["Dark", DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT]
  ])("in the %s mode at %ipx wide, the header", (mode, width, height) => {
    const githubMark = "M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656";
    const xMark = "M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z";

    const outside = (header: HTMLElement, selector: string): readonly HTMLElement[] => DocsFixture.all(document, selector).filter(t => !header.contains(t));

    const pathOf = (link: HTMLElement): SVGPathElement => {
      const path = link.querySelector("nol-docs-brand-mark[aria-hidden=true] svg path");
      if (!(path instanceof SVGPathElement))
        throw new TypeError("No mark's path in the link.");
      return path;
    };

    const nameOf = (element: HTMLElement): string =>
      [...element.childNodes].filter(t => t.nodeType === Node.TEXT_NODE).map(t => t.textContent).join(String()).trim();

    const renderHeaderAsync = async (): Promise<HTMLElement> => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      return DocsFixture.one(DocsFixture.host(await renderAsync("/")), ".nol-docs-header");
    };

    afterEach(() => ForcedColorsFixture.resetAsync());

    it("shows the Noldova wordmark, in the text's color, then TeamRun's name, linking home", async () => {
      const header = await renderHeaderAsync();
      const brand = DocsFixture.one(header, ".nol-docs-brand");
      const wordmark = DocsFixture.one(brand, "[role=img]");
      const name = DocsFixture.byText(brand, "span", "TeamRun");
      const style = getComputedStyle(wordmark);
      const em = Number.parseFloat(getComputedStyle(brand).fontSize);
      const rem = DocsFixture.rem();
      const mark = wordmark.getBoundingClientRect();
      const named = name.getBoundingClientRect();

      expect(wordmark.getAttribute("aria-label")).toBe("Noldova");
      expect(brand.getAttribute("href")).toBe("/");
      expect(style.backgroundColor).toBe(getComputedStyle(brand).color);
      expect(style.maskImage).toContain("/assets/noldova-wordmark.svg");
      expect(mark.height / em).toBeCloseTo(0.75, 2);
      expect(mark.width / mark.height).toBeCloseTo(1333.817 / 201.396, 1);
      expect(mark.right).toBeLessThanOrEqual(named.left);
      expect(Math.abs(mark.top + mark.height / 2 - (named.top + named.height / 2)) / rem).toBeLessThanOrEqual(0.25);
    });

    it("draws the wordmark in the link color under forced colors, as the brand link's text", async () => {
      await ForcedColorsFixture.activateAsync();
      const brand = DocsFixture.one(await renderHeaderAsync(), ".nol-docs-brand");
      const background = getComputedStyle(DocsFixture.one(brand, "[role=img]")).backgroundColor;

      expect(background).toBe(ForcedColorsFixture.resolve("LinkText"));
      expect(background).toBe(getComputedStyle(brand).color);
    });

    it("links to TeamRun's repository and to Noldova on X in this tab, each named by its brand and showing only that brand's mark", async () => {
      const header = await renderHeaderAsync();
      const links = DocsFixture.all(header, ".nol-docs-header-link");

      expect(links.map(t => [t.getAttribute("aria-label"), nameOf(t), t.getAttribute("href"), t.getAttribute("target")])).toEqual([
        ["GitHub", String(), "https://github.com/noldova-com/teamrun", null],
        ["X", String(), "https://x.com/noldova", null]
      ]);
      expect(links.map(t => pathOf(t).getAttribute("d"))).toEqual([githubMark, xMark]);
    });

    it("draws each mark 1rem square in the middle of a pointer target, black in the Light look and white in the Dark one", async () => {
      const header = await renderHeaderAsync();
      const rem = DocsFixture.rem();
      const target = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nol-pointer-target"));

      for (const link of DocsFixture.all(header, ".nol-docs-header-link")) {
        const box = link.getBoundingClientRect();
        const mark = DocsFixture.one(link, "nol-docs-brand-mark").getBoundingClientRect();

        expect(mark.width / rem).toBeCloseTo(1, 2);
        expect(mark.height / rem).toBeCloseTo(1, 2);
        expect(box.width).toBeGreaterThanOrEqual(target);
        expect(box.height).toBeGreaterThanOrEqual(target);
        expect(Math.abs(mark.left + mark.width / 2 - (box.left + box.width / 2)) / rem).toBeLessThanOrEqual(0.05);
        expect(Math.abs(mark.top + mark.height / 2 - (box.top + box.height / 2)) / rem).toBeLessThanOrEqual(0.05);
        expect(getComputedStyle(pathOf(link)).fill).toBe(mode === "Light" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
      }
    });

    it("takes each mark's color from the site's --nol-docs-brand-mark", async () => {
      const header = await renderHeaderAsync();
      const root = document.documentElement;
      root.style.setProperty("--nol-docs-brand-mark", "rgb(1, 2, 3)");
      const fills = DocsFixture.all(header, ".nol-docs-header-link").map(t => getComputedStyle(pathOf(t)).fill);
      root.style.removeProperty("--nol-docs-brand-mark");

      expect(fills).toEqual(["rgb(1, 2, 3)", "rgb(1, 2, 3)"]);
    });

    it("shows each link's name as its tooltip under the pointer, inside the window", async () => {
      const header = await renderHeaderAsync();

      for (const link of DocsFixture.all(header, ".nol-docs-header-link")) {
        await userEvent.hover(link);
        await DocsFixture.untilAsync(() => expect(outside(header, "[role=\"tooltip\"]").map(t => t.textContent.trim())).toEqual([link.getAttribute("aria-label")]));
        const tip = outside(header, "[role=\"tooltip\"]")[0]?.getBoundingClientRect();

        expect(tip?.left).toBeGreaterThanOrEqual(0);
        expect(tip?.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
        await userEvent.unhover(link);
        await DocsFixture.untilAsync(() => expect(outside(header, "[role=\"tooltip\"]")).toEqual([]));
      }
    });

    it("draws each mark in the link color under forced colors", async () => {
      await ForcedColorsFixture.activateAsync();
      const header = await renderHeaderAsync();

      for (const link of DocsFixture.all(header, ".nol-docs-header-link")) {
        const fill = getComputedStyle(pathOf(link)).fill;

        expect(fill).toBe(ForcedColorsFixture.resolve("LinkText"));
        expect(fill).toBe(getComputedStyle(link).color);
      }
    });

    it("keeps the brand first on a desktop and right after the menu button on a phone, the links last, and every part inside the window", async () => {
      const header = await renderHeaderAsync();
      const rem = DocsFixture.rem();
      const box = header.getBoundingClientRect();
      const brand = DocsFixture.one(header, ".nol-docs-brand").getBoundingClientRect();
      const search = DocsFixture.one(header, "nol-docs-search").getBoundingClientRect();
      const theme = DocsFixture.one(header, "nol-docs-theme-switch").getBoundingClientRect();
      const links = DocsFixture.all(header, ".nol-docs-header-link").map(t => t.getBoundingClientRect());
      const last = DocsFixture.one(header, ".nol-docs-header-link:last-child nol-docs-brand-mark").getBoundingClientRect();
      const style = getComputedStyle(header);
      const first = width === DocsFixture.DESKTOP_WIDTH ? brand : DocsFixture.one(header, "button.nol-docs-menu-button").getBoundingClientRect();

      expect((first.left - box.left - Number.parseFloat(style.paddingInlineStart)) / rem).toBeCloseTo(0, 2);
      if (width !== DocsFixture.DESKTOP_WIDTH)
        expect(brand.left).toBeGreaterThanOrEqual(first.right);
      expect((box.right - last.right - Number.parseFloat(style.paddingInlineEnd)) / rem).toBeCloseTo(0, 2);
      for (const part of [brand, search, theme, ...links])
        expect(part.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
      for (const link of links) {
        expect(link.left).toBeGreaterThanOrEqual(theme.right);
        expect(Math.abs(link.top + link.height / 2 - (theme.top + theme.height / 2)) / rem).toBeLessThanOrEqual(0.25);
      }
      if (width === DocsFixture.DESKTOP_WIDTH) {
        expect(search.left).toBeGreaterThanOrEqual(brand.right);
        expect(theme.left).toBeGreaterThanOrEqual(search.right);
        for (const part of [search, theme])
          expect(Math.abs(part.top + part.height / 2 - (brand.top + brand.height / 2)) / rem).toBeLessThanOrEqual(0.25);
      }
      else {
        expect(search.top).toBeGreaterThanOrEqual(brand.bottom);
        expect(theme.top).toBeGreaterThanOrEqual(search.bottom);
      }
    });
  });

  it("puts the menu beside the page on a desktop, with no menu button, and behind a closed menu button on a phone", async () => {
    const host = DocsFixture.host(await renderAsync("/"));
    const menu = DocsFixture.one(host, "nav");
    const main = DocsFixture.one(host, "main");
    const button = DocsFixture.one(host, "button.nol-docs-menu-button");

    expect(menu.getBoundingClientRect().right).toBeLessThanOrEqual(main.getBoundingClientRect().left);
    expect(getComputedStyle(button).display).toBe("none");

    await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
    await DocsFixture.untilAsync(() => expect(getComputedStyle(menu).display).toBe("none"));
    expect(button.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(menu.id);
  });

  describe("the menu", () => {
    it("lists every page of the catalog once, in its order, under the Start, Using TeamRun and Reference groups", async () => {
      const nav = DocsFixture.one(DocsFixture.host(await renderAsync("/")), "nav");
      const lists = DocsFixture.all(nav, ".nol-docs-menu-list");

      expect(DocsFixture.all(nav, "nol-section-header").map(t => t.textContent.trim())).toEqual(["Start", "Using TeamRun", "Reference"]);
      expect(lists.map(t => DocsFixture.all(t, "a").map(u => u.textContent.trim()))).toEqual([
        ["TeamRun", "Getting started", "Install"],
        ["Providers and sign-in", "What each provider can do", "ACP agents", "Chats and teammates", "Following and approving the work", "Organization", "Projects and folders",
          "Tools teammates use", "When usage runs out", "Settings"],
        ["Privacy and network", "The teamrun command", "Troubleshooting", "FAQ", "Release notes"]
      ]);
      expect(DocsFixture.all(nav, "a").map(t => t.getAttribute("href"))).toEqual(DocsCatalog.pages.map(t => t.link));
      expect(DocsFixture.all(nav, ":scope > a")).toEqual([]);
    });

    it.each(DocsCatalog.pages.map(t => [t.link, t.title]))("marks only %s's link current on its page, and shows its title as the page's heading", async (link, title) => {
      const fixture = await renderAsync(link);
      const nav = DocsFixture.one(DocsFixture.host(fixture), "nav");

      expect(DocsFixture.all(nav, "[aria-current=page]").map(t => t.textContent.trim())).toEqual([title]);
      expect(DocsFixture.all(nav, ".nol-docs-menu-current").map(t => t.textContent.trim())).toEqual([title]);
      expect(heading(fixture)).toBe(title);
    });

    it("reaches the Install page from its menu group and moves the current mark to it", async () => {
      const fixture = await renderAsync("/");
      const nav = DocsFixture.one(DocsFixture.host(fixture), "nav");

      await userEvent.click(DocsFixture.byText(nav, "a", "Install"));

      await DocsFixture.untilAsync(() => expect(heading(fixture)).toBe("Install"));
      expect(DocsFixture.byText(nav, "a", "Install").getAttribute("aria-current")).toBe("page");
      expect(DocsFixture.byText(nav, "a", "TeamRun").getAttribute("aria-current")).toBeNull();
    });

    describe.each(DocsFixture.MODES)("in the %s mode", mode => {
      it("starts each link's text at the same edge, a rem-measured inset from the menu's, and fills the current one inside the menu", async () => {
        DocsFixture.setMode(mode);
        const nav = DocsFixture.one(DocsFixture.host(await renderAsync("/install")), "nav");
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
    const scrolledAsync = async (): Promise<{ host: HTMLElement; header: HTMLElement; height: number }> => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(SamplePageFixture.LINK));
      const header = DocsFixture.one(host, ".nol-docs-header");
      await sampleAsync(host);
      const before = header.getBoundingClientRect().height;
      window.scrollTo(0, document.documentElement.scrollHeight / 2);
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(before));
      return { host, header, height: before };
    };

    it("keeps the header at the top of the window, at its height and in front of the page", async () => {
      const { header, height: before } = await scrolledAsync();
      const box = header.getBoundingClientRect();

      expect(box.top).toBe(0);
      expect(box.height).toBeCloseTo(before, 1);
      expect(getComputedStyle(header).backgroundColor).toMatch(/^rgb\(/u);
      expect(header.contains(document.elementFromPoint(box.left + box.width / 2, box.bottom - 1))).toBe(true);
      expect(header.contains(document.elementFromPoint(box.left + 1, box.top + 1))).toBe(true);
    });

    it("keeps the menu right below the header, in front of the page and in the window wherever the page is scrolled", async () => {
      const { host, header } = await scrolledAsync();
      const menu = DocsFixture.one(host, "nav#nol-docs-menu");
      if (width === DocsFixture.PHONE_WIDTH) {
        await userEvent.click(DocsFixture.one(host, "button.nol-docs-menu-button"));
        await DocsFixture.untilAsync(() => expect(menu.getBoundingClientRect().height).toBeGreaterThan(0));
      }
      const expectInView = (): void => {
        const box = menu.getBoundingClientRect();

        expect(Math.abs(box.top - header.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0.5);
        expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
        expect(menu.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
      };

      expectInView();
      const scrolled = window.scrollY;
      window.scrollTo(0, scrolled + window.innerHeight / 2);
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(scrolled));
      expectInView();
      expect(getComputedStyle(menu).overflowY).toBe("auto");
    });

    it("lands a heading an address names fully below the header", async () => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(width, height);
      const host = DocsFixture.host(await renderAsync(`${SamplePageFixture.LINK}#your-first-chat`));
      const header = DocsFixture.one(host, ".nol-docs-header");
      await sampleAsync(host);

      await DocsFixture.untilAsync(() => {
        const target = DocsFixture.one(host, "#your-first-chat");
        expect(window.scrollY).toBeGreaterThan(0);
        expect(Math.abs(target.getBoundingClientRect().top - header.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
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
    const header = DocsFixture.one(DocsFixture.host(fixture), ".nol-docs-header");

    expect(root.style.getPropertyValue("--nol-docs-header-height")).toBe(`${header.getBoundingClientRect().height}px`);
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
      const header = DocsFixture.one(host, ".nol-docs-header");
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

    describe.each(DocsFixture.MODES)("in the %s mode", mode => {
      it("marks the menu's current page with the highlight fill and its text on a desktop, through hover and focus", async () => {
        DocsFixture.setMode(mode);
        await ForcedColorsFixture.activateAsync();
        const nav = DocsFixture.one(DocsFixture.host(await renderAsync("/install")), "nav");
        await DocsFixture.untilAsync(() => expect(getComputedStyle(nav).display).toBe("grid"));

        await expectCurrentMarkedAsync(nav);
      });

      it("marks the current page the same way in the phone menu", async () => {
        DocsFixture.setMode(mode);
        await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
        await ForcedColorsFixture.activateAsync();
        const host = DocsFixture.host(await renderAsync("/install"));
        const nav = DocsFixture.one(host, "nav");
        const button = DocsFixture.one(host, "button.nol-docs-menu-button");

        button.focus();
        await userEvent.keyboard("{Enter}");
        await DocsFixture.untilAsync(() => expect(getComputedStyle(nav).display).toBe("grid"));

        await expectCurrentMarkedAsync(nav);
      });
    });
  });

  describe.each(DocsFixture.MODES)("on a phone in the %s mode, a %s color scheme", (mode, scheme) => {
    it("starts the page's content right under the header, and opens the menu above it from the menu button", async () => {
      DocsFixture.setMode(mode);
      await DocsFixture.viewAsync(DocsFixture.PHONE_WIDTH, DocsFixture.PHONE_HEIGHT);
      const host = DocsFixture.host(await renderAsync("/install"));
      const header = DocsFixture.one(host, ".nol-docs-header");
      const menu = DocsFixture.one(host, "nav");
      const main = DocsFixture.one(host, "main");
      const button = DocsFixture.one(host, "button.nol-docs-menu-button");

      expect(getComputedStyle(document.documentElement).colorScheme).toBe(scheme);
      expect(main.getBoundingClientRect().top).toBe(header.getBoundingClientRect().bottom);
      expect(DocsFixture.one(main, "h1").getBoundingClientRect().bottom).toBeLessThanOrEqual(DocsFixture.PHONE_HEIGHT / 2);
      expect(button.getBoundingClientRect().left).toBeGreaterThanOrEqual(header.getBoundingClientRect().left);

      await userEvent.click(button);
      await DocsFixture.untilAsync(() => expect(button.getAttribute("aria-expanded")).toBe("true"));
      expect(menu.getBoundingClientRect().top).toBe(header.getBoundingClientRect().bottom);
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
    const menu = DocsFixture.one(host, "nav");
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
      const menu = DocsFixture.one(host, "nav");
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
    const link = DocsFixture.byText(DocsFixture.one(DocsFixture.host(fixture), "nav"), "a", "Install");

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
      const header = DocsFixture.one(host, ".nol-docs-header");
      const menu = DocsFixture.one(host, "nav#nol-docs-menu");
      const button = DocsFixture.one(host, "button.nol-docs-menu-button");
      if (button.getBoundingClientRect().width > 0) {
        await userEvent.click(button);
        await DocsFixture.untilAsync(() => expect(menu.getBoundingClientRect().height).toBeGreaterThan(0));
      }
      const expectInView = (): void => {
        const box = menu.getBoundingClientRect();

        expect(header.getBoundingClientRect().top).toBe(0);
        expect(Math.abs(box.top - header.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0.5);
        expect(box.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
        expect(menu.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
      };

      expectInView();
      window.scrollTo(0, document.documentElement.scrollHeight / 2);
      await DocsFixture.untilAsync(() => expect(window.scrollY).toBeGreaterThan(0));
      expectInView();
    });

    it("lays the menu, the page and the list across at most 108rem centered in the window, 3.5rem in from its sides from 75rem wide, the page filling the space between them", async () => {
      const host = await pageAsync();
      const rem = DocsFixture.rem();
      const body = DocsFixture.one(host, ".nol-docs-body");
      const box = body.getBoundingClientRect();
      const style = getComputedStyle(body);
      const main = DocsFixture.one(host, "main");
      const mainBox = main.getBoundingClientRect();
      const mainStyle = getComputedStyle(main);
      const page = DocsFixture.one(host, ".nol-docs-page").getBoundingClientRect();
      const inset = width >= 75 * rem ? 3.5 : 0;

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

    it("starts the header's brand where the menu's text starts and ends its last link's mark where the list's links end", async () => {
      const host = await deskAsync();
      const rem = DocsFixture.rem();
      const range = document.createRange();
      range.selectNodeContents(DocsFixture.one(host, ".nol-docs-menu-link"));
      const menuText = range.getBoundingClientRect().left;
      const lastMark = DocsFixture.all(host, ".nol-docs-header-link nol-docs-brand-mark").at(-1)?.getBoundingClientRect().right ?? Number.NaN;
      const list = DocsFixture.one(host, ".nol-docs-outline-list");

      expect(Math.abs(DocsFixture.one(host, ".nol-docs-wordmark").getBoundingClientRect().left - menuText) / rem).toBeLessThanOrEqual(0.01);
      expect(Math.abs(lastMark - list.getBoundingClientRect().right) / rem).toBeLessThanOrEqual(0.01);
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
