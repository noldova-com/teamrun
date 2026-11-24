/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources";
import { DocsCatalog } from "./docs-catalog";
import type { DocsPage } from "./docs-page";
import { DocsSearchEntry } from "./docs-search-entry";

export class DocsSearchIndex {
  private static readonly HEADING: RegExp = /^#{2,3} +(.+)$/gmu;

  public static readonly entries: readonly DocsSearchEntry[] = DocsCatalog.pages.map(t => DocsSearchIndex.index(t));

  public static search(query: string): readonly DocsPage[] {
    const normalized = query.trim().toLocaleLowerCase("en");
    if (String.isNullOrEmpty(normalized))
      return [];
    return DocsSearchIndex.entries.filter(t => t.matches(normalized)).map(t => t.page);
  }

  private static index(page: DocsPage): DocsSearchEntry {
    const headings = [...page.text.matchAll(DocsSearchIndex.HEADING)].map(t => String(t[1]).trim());
    return new DocsSearchEntry(page, [page.title, Resources.groupLabels[page.group], ...headings]);
  }
}
