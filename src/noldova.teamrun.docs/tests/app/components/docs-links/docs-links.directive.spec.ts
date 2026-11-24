/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { MarkdownViewComponent, provideMarkdown } from "@noldova/ui.components.angular/markdown";
import type { MockInstance } from "vitest";
import { userEvent } from "vitest/browser";

import { routes } from "../../../../src/app/app.routes";
import { DocsLinksDirective } from "../../../../src/app/components/docs-links/docs-links.directive";
import { DocsCatalog } from "../../../../src/app/models/docs-catalog";
import type { DocsPage } from "../../../../src/app/models/docs-page";
import { Resources } from "../../../../src/resources";
import { DocsFixture } from "../../../fixtures/docs.fixture";

@Component({
  selector: "test-page",
  template: ""
})
class PageComponent {}

@Component({
  selector: "test-docs-links",
  imports: [DocsLinksDirective, MarkdownViewComponent],
  template: `<nol-markdown-view nolDocsLinks [text]="text" />`
})
class DocsLinksHostComponent {
  public readonly text: string = [
    `[install](${Resources.siteLink}install)`,
    `[slashed](${Resources.siteLink}install/)`,
    `[section](${Resources.siteLink}install#on-linux)`,
    `[home](${Resources.siteLink})`,
    `[unlisted](${Resources.siteLink}no-such-page)`,
    `[deeper](${Resources.siteLink}install/more)`,
    "[elsewhere](https://example.com/a)"
  ].join(" ");
}

describe("DocsLinksDirective", () => {
  const siteLinks = /\]\((https:\/\/teamrun\.noldova\.dev\/[^)\s]*)\)/gu;

  const renderAsync = async (): Promise<HTMLElement> => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: "install", component: PageComponent }, { path: "", component: PageComponent }, { path: "**", component: PageComponent }]),
      provideMarkdown()] });
    const fixture = TestBed.createComponent(DocsLinksHostComponent);
    await fixture.whenStable();
    const host = DocsFixture.host(fixture);
    await DocsFixture.untilAsync(() => expect(DocsFixture.all(host, "a").length).toBe(7));
    return host;
  };

  const opened = (): MockInstance<Window["open"]> => vi.spyOn(window, "open").mockReturnValue(null);

  const click = (link: HTMLElement, init: MouseEventInit = {}): void => {
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  };

  const router = (): Router => TestBed.inject(Router);

  const external = (path: string): string => TestBed.inject(Location).prepareExternalUrl(path);

  afterEach(async () => {
    vi.restoreAllMocks();
    await DocsFixture.resetAsync();
  });

  it("opens a page of the site in this tab on a click, through the router, with or without its trailing slash", async () => {
    const host = await renderAsync();
    const open = opened();

    click(DocsFixture.byText(host, "a", "install"));
    await DocsFixture.routedAsync(router(), "/install");
    await router().navigateByUrl("/elsewhere");
    click(DocsFixture.byText(host, "a", "slashed"));
    await DocsFixture.routedAsync(router(), "/install");

    expect(open).not.toHaveBeenCalled();
  });

  it("opens the site's home page in this tab on a click", async () => {
    const host = await renderAsync();
    const open = opened();
    await router().navigateByUrl("/install");

    click(DocsFixture.byText(host, "a", "home"));

    await DocsFixture.routedAsync(router(), "/");
    expect(open).not.toHaveBeenCalled();
  });

  it("opens a section on a page of the site, keeping the anchor, on Enter", async () => {
    const host = await renderAsync();
    const open = opened();

    DocsFixture.byText(host, "a", "section").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));

    await DocsFixture.routedAsync(router(), "/install#on-linux");
    expect(open).not.toHaveBeenCalled();
  });

  it("opens a page of the site in a new tab on a Ctrl click, leaving this tab where it is", async () => {
    const host = await renderAsync();
    const open = opened();

    click(DocsFixture.byText(host, "a", "install"), { ctrlKey: true });

    expect(open.mock.calls).toEqual([[external("/install"), "_blank", "noopener"]]);
    expect(router().url).toBe("/");
  });

  it("opens a page of the site in one new tab on a middle click, keeping the browser from opening its own, and leaves this tab where it is", async () => {
    const host = await renderAsync();
    const open = opened();
    const clicks: MouseEvent[] = [];
    const record = (event: MouseEvent): void => {
      clicks.push(event);
    };
    document.addEventListener("auxclick", record);

    try {
      await userEvent.click(DocsFixture.byText(host, "a", "install"), { button: "middle" });
      await DocsFixture.untilAsync(() => expect(clicks.length).toBe(1));
    } finally {
      document.removeEventListener("auxclick", record);
    }

    expect(open.mock.calls).toEqual([[external("/install"), "_blank", "noopener"]]);
    expect(clicks.map(t => t.defaultPrevented)).toEqual([true]);
    expect(router().url).toBe("/");
  });

  it("opens an address of the site with no page here, one deeper than a page, and any other address, at that address in a new tab", async () => {
    const host = await renderAsync();
    const open = opened();

    click(DocsFixture.byText(host, "a", "unlisted"));
    click(DocsFixture.byText(host, "a", "deeper"));
    click(DocsFixture.byText(host, "a", "elsewhere"));

    expect(open.mock.calls).toEqual([[`${Resources.siteLink}no-such-page`, "_blank", "noopener"], [`${Resources.siteLink}install/more`, "_blank", "noopener"],
      ["https://example.com/a", "_blank", "noopener"]]);
    expect(router().url).toBe("/");
  });

  it("finds an in-site link on the site's pages, and every one leads to a page of the catalog", () => {
    const paths = new Set(routes.map(t => t.path));
    const linksOf = (page: DocsPage): string[] => [...page.text.matchAll(siteLinks)].map(t => String(t[1]));
    const links = DocsCatalog.pages.flatMap(t => linksOf(t));
    const pathOf = (link: string): string => link.slice(Resources.siteLink.length).replace(/#.*$/u, String()).replace(/\/$/u, String());

    expect(links.length).toBeGreaterThan(0);
    expect(links.filter(t => !paths.has(pathOf(t)))).toEqual([]);
    expect(DocsCatalog.pages.filter(t => t.file === "home").flatMap(t => linksOf(t))).toContain(`${Resources.siteLink}getting-started`);
  });

  it("leaves no page's link to another page as a relative Markdown file the site can't open", () => {
    expect(DocsCatalog.pages.filter(t => /\]\([a-z0-9-]+\.md[#)]/u.test(t.text)).map(t => t.file)).toEqual([]);
  });
});
