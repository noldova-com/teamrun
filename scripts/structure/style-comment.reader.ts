/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ICommentReader from "./interfaces/comment-reader.ts";
import LicenseHeader from "./license-header.ts";

export default class StyleCommentReader implements ICommentReader {
  private static readonly BLOCK_COMMENT_START: string = "/*";
  private static readonly BLOCK_COMMENT_END: string = "*/";
  private static readonly LINE_COMMENT_START: string = "//";
  private static readonly URL_START: string = "url(";
  private static readonly URL_END: string = ")";
  private static readonly LINE_FEED: string = "\n";
  private static readonly BACKSLASH: string = "\\";
  private static readonly QUOTES: ReadonlySet<string> = new Set(["\"", "'"]);

  public readonly header: string = LicenseHeader.BLOCK;

  public readCommentLines(text: string): readonly number[] {
    const lines: number[] = [];
    let line = 1;
    let position = 0;
    while (position < text.length) {
      const character = text.charAt(position);
      let next = position + 1;
      if (text.startsWith(StyleCommentReader.BLOCK_COMMENT_START, position)) {
        lines.push(line);
        next = StyleCommentReader.findEnd(text, StyleCommentReader.BLOCK_COMMENT_END, position + StyleCommentReader.BLOCK_COMMENT_START.length) + StyleCommentReader.BLOCK_COMMENT_END.length;
      } else if (text.startsWith(StyleCommentReader.LINE_COMMENT_START, position)) {
        lines.push(line);
        next = StyleCommentReader.findEnd(text, StyleCommentReader.LINE_FEED, position);
      } else if (text.startsWith(StyleCommentReader.URL_START, position))
        next = StyleCommentReader.findEnd(text, StyleCommentReader.URL_END, position) + StyleCommentReader.URL_END.length;
      else if (StyleCommentReader.QUOTES.has(character))
        next = StyleCommentReader.findStringEnd(text, position);
      line += text.slice(position, next).split(StyleCommentReader.LINE_FEED).length - 1;
      position = next;
    }
    return lines;
  }

  private static findEnd(text: string, marker: string, start: number): number {
    const end = text.indexOf(marker, start);
    return end < 0 ? text.length : end;
  }

  private static findStringEnd(text: string, start: number): number {
    const quote = text.charAt(start);
    let position = start + 1;
    while (position < text.length && text.charAt(position) !== quote && text.charAt(position) !== StyleCommentReader.LINE_FEED)
      position += text.charAt(position) === StyleCommentReader.BACKSLASH ? 2 : 1;
    return position + 1;
  }
}
