/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from "node:module";
import path from "node:path";
import type { Writable } from "node:stream";
import { pathToFileURL } from "node:url";

import type { ICheck } from "../../../scripts/checks/interfaces/i-check.ts";
import { JsonFields } from "../../../scripts/totals/json-fields.ts";
import { DocsMenuLink } from "./docs/docs-menu-link.ts";
import { DocsSiteServer } from "./docs/docs-site-server.ts";
import type { IPlaywrightModule } from "./docs/interfaces/i-playwright-module.ts";
import type { ISiteBrowser } from "./docs/interfaces/i-site-browser.ts";
import type { ISitePage } from "./docs/interfaces/i-site-page.ts";

export class DocsSiteCheck implements ICheck {
  private static readonly SITE_FOLDER: string = "_build/docs/browser";
  private static readonly PACKAGE_MANIFEST: string = "src/noldova.teamrun.docs/package.json";
  private static readonly PLAYWRIGHT: string = "playwright";
  private static readonly HOME: string = "/";
  private static readonly ERROR_TYPE: string = "error";
  private static readonly OK_STATUS: number = 200;
  private static readonly LOAD_TIMEOUT: number = 15000;
  private static readonly TIMEOUT_ERROR: string = "TimeoutError";
  private static readonly IMAGE_TYPE: string = "image/";
  private static readonly ICONS: string =
    "Promise.all([...document.querySelectorAll('link[rel=icon], link[rel=apple-touch-icon]')].map(t => fetch(t.href).then(r => ({ link: t.getAttribute('href') ?? '', status: r.status, type: r.headers.get('content-type') ?? '' })))).then(t => JSON.stringify({ icons: t }))";
  private static readonly MENU_LINKS: string =
    "JSON.stringify({ links: [...document.querySelectorAll('a.nol-docs-menu-link')].map(t => ({ link: t.getAttribute('href') ?? '', title: (t.textContent ?? '').trim() })) })";
  private static readonly SETTLED: string =
    "document.querySelectorAll('h1').length > 0 && document.querySelectorAll('.nol-docs-page-body .nol-markdown-blocks > *').length > 0";
  private static readonly SHOWN: string = "JSON.stringify({ titles: [...document.querySelectorAll('h1')].map(t => (t.textContent ?? '').trim()) })";
  private static readonly BROKEN_WORDS: string =
    "JSON.stringify({ words: [...document.querySelectorAll('.nol-markdown-table th, .nol-markdown-table td')].flatMap(cell => { const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT); const words = []; for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) for (const word of (node.textContent ?? '').matchAll(/[\\p{L}\\p{N}_]+/gu)) { const range = document.createRange(); range.setStart(node, word.index); range.setEnd(node, word.index + word[0].length); if (new Set([...range.getClientRects()].filter(t => t.width > 0).map(t => Math.round(t.top))).size > 1) words.push(word[0]); } return words; }), names: [...document.querySelectorAll('.nol-docs-page .nol-markdown-table code')].filter(t => t.getClientRects().length > 1).map(t => t.textContent ?? '') })";
  private static readonly SITE_STYLES: string = "getComputedStyle(document.documentElement).getPropertyValue('--nol-site-shell-gutter').trim()";
  private static readonly NEXT_FRAME: string = "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(0))))";
  private static readonly WIDTHS: readonly number[] = [1280, 375];
  private static readonly VIEW_HEIGHT: number = 800;

  private readonly root: string;

  public readonly title: string = "The built docs site";

  public constructor(root: string) {
    this.root = root;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const server = new DocsSiteServer(path.join(this.root, DocsSiteCheck.SITE_FOLDER));
    const address = await server.startAsync();
    const browser = await (await this.loadPlaywrightAsync()).default.chromium.launch();
    try {
      const findings: string[] = [];
      const links = await this.readMenuAsync(browser, address, findings);
      for (const link of links)
        await this.checkPageAsync(browser, address, link.link, link.title, findings);
      for (const finding of findings)
        output.write(`${finding}\n`);
      output.write(`Opened ${links.length} pages of ${DocsSiteCheck.SITE_FOLDER} that the site's menu links.\n`);
      return findings.length === 0 && links.length > 0;
    }
    finally {
      await browser.close();
      await server.stopAsync();
    }
  }

  private async loadPlaywrightAsync(): Promise<IPlaywrightModule> {
    const require = createRequire(path.join(this.root, DocsSiteCheck.PACKAGE_MANIFEST));
    return import(pathToFileURL(require.resolve(DocsSiteCheck.PLAYWRIGHT)).href);
  }

  private async readMenuAsync(browser: ISiteBrowser, address: string, findings: string[]): Promise<readonly DocsMenuLink[]> {
    const page = await browser.newPage();
    try {
      const response = await page.goto(new URL(DocsSiteCheck.HOME, address).href);
      if (response?.status() !== DocsSiteCheck.OK_STATUS) {
        findings.push(DocsSiteCheck.notServed(DocsSiteCheck.HOME));
        return [];
      }
      const icons = JsonFields.parse(String(await page.evaluate(DocsSiteCheck.ICONS)), DocsSiteCheck.HOME).objects("icons");
      if (icons.length === 0)
        findings.push(DocsSiteCheck.noIcons());
      if (String(await page.evaluate(DocsSiteCheck.SITE_STYLES)) === "")
        findings.push(DocsSiteCheck.noSiteStyles());
      for (const icon of icons.filter(t => t.count("status") !== DocsSiteCheck.OK_STATUS || !t.text("type").startsWith(DocsSiteCheck.IMAGE_TYPE)))
        findings.push(DocsSiteCheck.iconNotServed(icon.text("link"), icon.count("status"), icon.text("type")));
      const menu = JsonFields.parse(String(await page.evaluate(DocsSiteCheck.MENU_LINKS)), DocsSiteCheck.HOME);
      return menu.objects("links").map(t => new DocsMenuLink(t.text("link"), t.text("title")));
    }
    finally {
      await page.close();
    }
  }

  private async checkPageAsync(browser: ISiteBrowser, address: string, link: string, title: string, findings: string[]): Promise<void> {
    const page = await browser.newPage();
    const errors: string[] = [];
    DocsSiteCheck.collectErrors(page, errors);
    try {
      const response = await page.goto(new URL(link, address).href);
      if (response?.status() !== DocsSiteCheck.OK_STATUS) {
        findings.push(DocsSiteCheck.notServed(link));
        return;
      }
      try {
        await page.waitForFunction(DocsSiteCheck.SETTLED, undefined, { timeout: DocsSiteCheck.LOAD_TIMEOUT });
      }
      catch (error) {
        if (!DocsSiteCheck.isTimeout(error))
          throw error;
        findings.push(DocsSiteCheck.unsettled(link));
      }
      const shown = JsonFields.parse(String(await page.evaluate(DocsSiteCheck.SHOWN)), link);
      for (const width of DocsSiteCheck.WIDTHS)
        await DocsSiteCheck.checkWrapsAsync(page, link, width, findings);
      const titles = shown.texts("titles");
      if (titles.length !== 1 || titles[0] !== title)
        findings.push(DocsSiteCheck.wrongTitle(link, title, titles));
      findings.push(...errors.map(t => DocsSiteCheck.logged(link, t)));
    }
    finally {
      await page.close();
    }
  }

  private static async checkWrapsAsync(page: ISitePage, link: string, width: number, findings: string[]): Promise<void> {
    await page.setViewportSize({ width, height: DocsSiteCheck.VIEW_HEIGHT });
    await page.evaluate(DocsSiteCheck.NEXT_FRAME);
    const wraps = JsonFields.parse(String(await page.evaluate(DocsSiteCheck.BROKEN_WORDS)), link);
    const words = wraps.texts("words");
    const names = wraps.texts("names");
    if (words.length > 0)
      findings.push(DocsSiteCheck.wordsBroken(link, width, words));
    if (names.length > 0)
      findings.push(DocsSiteCheck.namesWrapped(link, width, names));
  }

  private static isTimeout(error: unknown): boolean {
    return error instanceof Error && error.name === DocsSiteCheck.TIMEOUT_ERROR;
  }

  private static collectErrors(page: ISitePage, errors: string[]): void {
    page.on("console", message => {
      if (message.type() === DocsSiteCheck.ERROR_TYPE)
        errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));
  }

  private static noIcons(): string {
    return `${DocsSiteCheck.HOME} links no favicon.`;
  }

  private static noSiteStyles(): string {
    return `${DocsSiteCheck.HOME} has none of the kit's site styles, such as --nol-site-shell-gutter from its styles/site.css, so the build took a kit older than the docs site's pin.`;
  }

  private static iconNotServed(link: string, status: number, type: string): string {
    return `The favicon ${link} is served with status ${status} and type "${type}", not as an image.`;
  }

  private static notServed(link: string): string {
    return `${link} isn't served from the built site.`;
  }

  private static unsettled(link: string): string {
    return `${link} still shows no h1 or no page text after ${DocsSiteCheck.LOAD_TIMEOUT / 1000} seconds.`;
  }

  private static wrongTitle(link: string, title: string, titles: readonly string[]): string {
    return `${link} should have one h1, "${title}", as its menu link names it, and has ${titles.length === 0 ? "none" : titles.map(t => `"${t}"`).join(", ")}.`;
  }

  private static wordsBroken(link: string, width: number, words: readonly string[]): string {
    return `${link} at ${width}px wide breaks words across lines in its tables: ${words.map(t => `"${t}"`).join(", ")}.`;
  }

  private static namesWrapped(link: string, width: number, names: readonly string[]): string {
    return `${link} at ${width}px wide wraps names, key names or types that stay on one line: ${names.map(t => `"${t}"`).join(", ")}.`;
  }

  private static logged(link: string, error: string): string {
    return `${link} logged an error: ${error}`;
  }
}
