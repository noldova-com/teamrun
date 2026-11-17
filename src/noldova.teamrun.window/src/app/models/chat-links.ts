/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources";
import type { ChatIds } from "./chat-ids";

export class ChatLinks {
  public static linked(ids: ChatIds, titleOf: (chatId: string) => string | null, isWhole: boolean): string {
    const text = ids.text;
    let literals: readonly (readonly [number, number])[] | null = null;
    let linked = "";
    let at = 0;
    for (const [offset, id] of ids.found) {
      const end = offset + id.length;
      const chatId = id.toLowerCase();
      const title = titleOf(chatId);
      if (Object.isNull(title) || (!isWhole && end === text.length))
        continue;
      literals ??= ChatLinks.literalsOf(text, isWhole);
      if (literals.some(([start, stop]) => offset < stop && end > start))
        continue;
      linked += `${text.slice(at, offset)}[${title.replace(Resources.markdownPunctuationPattern, Resources.markdownPunctuationEscape)}](${Resources.chatLinkPrefix}${chatId})`;
      at = end;
    }
    return `${linked}${text.slice(at)}`;
  }

  private static literalsOf(text: string, isWhole: boolean): readonly (readonly [number, number])[] {
    const literals: [number, number][] = [];
    let fence: string | null = null;
    let start = 0;
    const masked = text.split(Resources.lineSeparator).map(line => {
      const opening = Resources.markdownFencePattern.exec(line)?.[1] ?? null;
      const isCode = !Object.isNull(fence) || !Object.isNull(opening) || Resources.markdownIndentedCodePattern.test(line);
      const closes = !Object.isNull(fence) && !Object.isNull(opening) && opening[0] === fence[0] && opening.length >= fence.length && line.trim() === opening;
      fence = Object.isNull(fence) ? opening : closes ? null : fence;
      const from = start;
      start += line.length + Resources.lineSeparator.length;
      if (!isCode)
        return line;
      literals.push([from, from + line.length]);
      return " ".repeat(line.length);
    }).join(Resources.lineSeparator);
    for (const match of masked.matchAll(Resources.markdownLiteralPattern))
      literals.push([match.index, match.index + match[0].length]);
    if (isWhole)
      return literals;
    const open = Resources.markdownOpenLiteralPattern.exec(masked.replace(Resources.markdownLiteralPattern, literal => " ".repeat(literal.length)));
    if (!Object.isNull(open))
      literals.push([open.index, text.length]);
    return literals;
  }
}
