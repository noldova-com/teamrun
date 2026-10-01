/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import MarkdownLink from "./markdown-link.ts";

export default class MarkdownDocument {
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly COMMENT_START: string = "<!--";
  private static readonly COMMENT_END: string = "-->";
  private static readonly OPENING_FENCE_PATTERN: RegExp = /^ {0,3}(`{3,}|~{3,})/;
  private static readonly CLOSING_FENCE_PATTERN: RegExp = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
  private static readonly HEADING_PATTERN: RegExp = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
  private static readonly CODE_SPAN_PATTERN: RegExp = /(`+).*?\1/g;
  private static readonly INLINE_LINK_PATTERN: RegExp = /!?\[(?:[^[\]]|\[[^[\]]*\])*\]\(\s*(<[^<>]+>|[^\s<>()]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  private static readonly HEADING_LINK_PATTERN: RegExp = /!?\[((?:[^[\]]|\[[^[\]]*\])*)\]\([^)]*\)/g;
  private static readonly ANGLE_BRACKETS_PATTERN: RegExp = /^<(.*)>$/;
  private static readonly DEFINITION_PATTERN: RegExp = /^ {0,3}\[[^\]]+\]:[ \t]*<?([^\s<>]+)>?/;
  private static readonly REMOVED_ANCHOR_CHARACTERS: RegExp = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;
  private static readonly SPACE_PATTERN: RegExp = / /g;

  public readonly path: string;
  public readonly anchors: ReadonlySet<string>;
  public readonly links: readonly MarkdownLink[];

  public constructor(path: string, text: string) {
    const lines = MarkdownDocument.readVisibleLines(text);

    this.path = path;
    this.anchors = MarkdownDocument.readAnchors(lines);
    this.links = MarkdownDocument.readLinks(lines);
  }

  private static readVisibleLines(text: string): readonly string[] {
    const visible: string[] = [];
    let fence: string | null = null;
    let isComment = false;
    for (const line of text.split(MarkdownDocument.LINE_SEPARATOR)) {
      if (fence !== null) {
        const closing = MarkdownDocument.CLOSING_FENCE_PATTERN.exec(line)?.[1];
        if (closing !== undefined && closing[0] === fence[0] && closing.length >= fence.length)
          fence = null;
        visible.push("");
        continue;
      }

      let kept = "";
      let remaining = line;
      while (remaining.length > 0) {
        const marker = isComment ? MarkdownDocument.COMMENT_END : MarkdownDocument.COMMENT_START;
        const index = remaining.indexOf(marker);
        if (!isComment)
          kept += index < 0 ? remaining : remaining.slice(0, index);
        remaining = index < 0 ? "" : remaining.slice(index + marker.length);
        if (index >= 0)
          isComment = !isComment;
      }

      fence = MarkdownDocument.OPENING_FENCE_PATTERN.exec(kept)?.[1] ?? null;
      visible.push(fence === null ? kept : "");
    }
    return visible;
  }

  private static readAnchors(lines: readonly string[]): ReadonlySet<string> {
    const anchors = new Set<string>();
    const occurrences = new Map<string, number>();
    for (const line of lines) {
      const heading = MarkdownDocument.HEADING_PATTERN.exec(line);
      if (heading === null)
        continue;

      const anchor = MarkdownDocument.formatAnchor(heading[1] ?? "");
      const occurrence = occurrences.get(anchor) ?? 0;
      anchors.add(occurrence === 0 ? anchor : `${anchor}-${occurrence}`);
      occurrences.set(anchor, occurrence + 1);
    }
    return anchors;
  }

  private static formatAnchor(heading: string): string {
    return heading
      .replace(MarkdownDocument.HEADING_LINK_PATTERN, "$1")
      .toLowerCase()
      .replace(MarkdownDocument.REMOVED_ANCHOR_CHARACTERS, "")
      .replace(MarkdownDocument.SPACE_PATTERN, "-");
  }

  private static readLinks(lines: readonly string[]): readonly MarkdownLink[] {
    const links: MarkdownLink[] = [];
    for (const [index, line] of lines.entries()) {
      const text = line.replace(MarkdownDocument.CODE_SPAN_PATTERN, "");
      const definition = MarkdownDocument.DEFINITION_PATTERN.exec(text)?.[1];
      if (definition !== undefined)
        links.push(new MarkdownLink(definition, index + 1));
      for (const match of text.matchAll(MarkdownDocument.INLINE_LINK_PATTERN))
        if (match[1] !== undefined)
          links.push(new MarkdownLink(match[1].replace(MarkdownDocument.ANGLE_BRACKETS_PATTERN, "$1"), index + 1));
    }
    return links;
  }
}
