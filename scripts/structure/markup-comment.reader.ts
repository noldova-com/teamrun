/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ICommentReader from "./interfaces/comment-reader.ts";
import LicenseHeader from "./license-header.ts";

export default class MarkupCommentReader implements ICommentReader {
  private static readonly COMMENT_START: string = "<!--";
  private static readonly LINE_FEED: string = "\n";

  public readonly header: string = LicenseHeader.MARKUP;

  public readCommentLines(text: string): readonly number[] {
    const lines: number[] = [];
    for (let start = text.indexOf(MarkupCommentReader.COMMENT_START); start >= 0; start = text.indexOf(MarkupCommentReader.COMMENT_START, start + 1))
      lines.push(text.slice(0, start).split(MarkupCommentReader.LINE_FEED).length);
    return lines;
  }
}
