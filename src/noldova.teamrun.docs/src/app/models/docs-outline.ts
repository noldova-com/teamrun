/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { DocsOutlineEntry } from "./docs-outline-entry";

export class DocsOutline {
  private static readonly MARKDOWN_HEADING: string = ".nol-docs-page-body .nol-markdown-heading[role=heading]";
  private static readonly HEADINGS: string = [`${DocsOutline.MARKDOWN_HEADING}[aria-level="2"]`, `${DocsOutline.MARKDOWN_HEADING}[aria-level="3"]`].join(", ");
  private static readonly MARKDOWN_LEVEL_OFFSET: number = 2;
  private static readonly LEVEL_ATTRIBUTE: string = "aria-level";
  private static readonly NOT_IN_ID: RegExp = /[^\p{L}\p{N}]+/gu;
  private static readonly EDGE_DASHES: RegExp = /^-|-$/gu;
  private static readonly ID_SEPARATOR: string = "-";
  private static readonly FALLBACK_ID: string = "section";
  private static readonly FIRST_SUFFIX: number = 2;

  public static read(root: HTMLElement): readonly DocsOutlineEntry[] {
    const headings = [...root.querySelectorAll<HTMLElement>(DocsOutline.HEADINGS)];
    const taken = new Set(headings.map(t => t.id).filter(t => t !== String()));
    return headings.map(heading => {
      const title = heading.textContent.trim();
      if (heading.id === String())
        heading.id = DocsOutline.freeId(DocsOutline.idOf(title), root.ownerDocument, taken);
      return new DocsOutlineEntry(heading, heading.id, title, DocsOutline.depthOf(heading));
    });
  }

  public static currentOf(entries: readonly DocsOutlineEntry[], readingEdge: number, isAtEnd: boolean, viewHeight: number): DocsOutlineEntry | null {
    return entries.findLast(t => {
      const top = t.heading.getBoundingClientRect().top;
      return top <= readingEdge || (isAtEnd && top < viewHeight);
    }) ?? null;
  }

  private static depthOf(heading: HTMLElement): number {
    return Number(heading.getAttribute(DocsOutline.LEVEL_ATTRIBUTE)) - DocsOutline.MARKDOWN_LEVEL_OFFSET;
  }

  private static idOf(title: string): string {
    const id = title.toLowerCase().replace(DocsOutline.NOT_IN_ID, DocsOutline.ID_SEPARATOR).replace(DocsOutline.EDGE_DASHES, String());
    return id === String() ? DocsOutline.FALLBACK_ID : id;
  }

  private static freeId(base: string, document: Document, taken: Set<string>): string {
    let id = base;
    for (let suffix = DocsOutline.FIRST_SUFFIX; taken.has(id) || !Object.isNull(document.getElementById(id)); suffix++)
      id = `${base}${DocsOutline.ID_SEPARATOR}${suffix}`;
    taken.add(id);
    return id;
  }
}
