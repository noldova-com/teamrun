/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class TextCut {
  private static readonly segmenter: Intl.Segmenter = new Intl.Segmenter();

  public static toUnits(text: string, limit: number): string {
    return TextCut.cut(text, limit, t => t.length);
  }

  public static toPoints(text: string, limit: number): string {
    return TextCut.cut(text, limit, t => [...t].length);
  }

  private static cut(text: string, limit: number, size: (segment: string) => number): string {
    const kept: string[] = [];
    let used = 0;
    for (const grapheme of TextCut.segmenter.segment(text)) {
      used += size(grapheme.segment);
      if (used > limit)
        break;
      kept.push(grapheme.segment);
    }
    return kept.join(String.empty);
  }
}
