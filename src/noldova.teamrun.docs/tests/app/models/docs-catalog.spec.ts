/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { pageFiles } from "@docs-generated/pages";

import { DocsException } from "../../../src/app/exceptions/docs.exception";
import { DocsCatalog } from "../../../src/app/models/docs-catalog";
import { DocsPageText } from "../../../src/app/models/docs-page-text";
import { DocsSearchIndex } from "../../../src/app/models/docs-search-index";

describe("DocsCatalog", () => {
  it("gives each page of the catalog a Markdown file under src/pages, and each Markdown file a page", () => {
    const files = pageFiles.map(t => t.name);
    const pages = DocsCatalog.pages.map(t => t.file);

    expect(pages.filter(t => !files.includes(t))).toEqual([]);
    expect(files.filter(t => !pages.includes(t))).toEqual([]);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it("titles each page as its Markdown file's first heading does, and gives the page that heading's text without it", () => {
    expect(DocsCatalog.pages.map(t => [t.file, t.title])).toEqual(DocsCatalog.pages.map(t => [t.file, pageFiles.find(u => u.name === t.file)?.title]));
    expect(DocsCatalog.pages.filter(t => t.text.startsWith("# ") || t.text.trim() === String()).map(t => t.file)).toEqual([]);
  });

  it("names each page's file for its address, and the home page's home.md", () => {
    expect(DocsCatalog.pages.filter(t => t !== DocsCatalog.home && t.file !== t.path).map(t => t.file)).toEqual([]);
    expect([DocsCatalog.home.file, DocsCatalog.home.path, DocsCatalog.home.link]).toEqual(["home", "", "/"]);
  });

  it("gives every page an address of its own", () => {
    const links = DocsCatalog.pages.map(t => t.link);

    expect(new Set(links).size).toBe(links.length);
    expect(links).toEqual(["/", "/getting-started", "/install", "/providers", "/provider-features", "/acp-agents", "/chats", "/approving", "/organization", "/projects", "/tools", "/sustain",
      "/settings", "/privacy", "/command", "/troubleshooting", "/faq", "/release-notes"]);
  });

  it("menus every page once, in the catalog's order, in groups that each hold a page", () => {
    expect(DocsCatalog.menuGroups.map(t => t.label)).toEqual(["Start", "Using TeamRun", "Reference"]);
    expect(DocsCatalog.menuGroups.every(t => t.pages.length > 0)).toBe(true);
    expect(DocsCatalog.menuGroups.flatMap(t => t.pages)).toEqual(DocsCatalog.pages);
  });

  it("refuses a page whose Markdown file is missing, naming the file", () => {
    expect(() => DocsPageText.of("no-such-page")).toThrow(new DocsException("No Markdown file under src/pages is named no-such-page.md."));
  });
});

describe("DocsSearchIndex", () => {
  it("finds nothing for an empty or blank query", () => {
    expect([DocsSearchIndex.search(String()), DocsSearchIndex.search("   ")]).toEqual([[], []]);
  });

  it("finds a page by its title, its menu group's name, or one of its second- or third-level headings, whatever the case", () => {
    const install = DocsCatalog.pages.find(t => t.file === "install");
    const entry = DocsSearchIndex.entries.find(t => t.page === install);

    expect(DocsSearchIndex.search(" Install ").map(t => t.title)).toEqual(["Install"]);
    expect(DocsSearchIndex.search("start").map(t => t.title)).toEqual(["TeamRun", "Getting started", "Install"]);
    expect(entry?.terms.slice(0, 2)).toEqual(["install", "start"]);
  });
});
