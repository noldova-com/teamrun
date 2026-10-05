/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { TextMatch } from "./text-match";

export class WordBreaks {
  public static split(parts: readonly TextMatch[]): readonly TextMatch[] {
    const text = parts.map(t => t.text).join(String.empty);
    let offset = 0;
    return parts.map(part => {
      const pieces: string[] = [];
      let start = 0;
      for (let index = 1; index < part.text.length; index++)
        if (WordBreaks.isBreak(text, offset + index)) {
          pieces.push(part.text.slice(start, index));
          start = index;
        }
      pieces.push(part.text.slice(start));
      const breaksBefore = offset > 0 && WordBreaks.isBreak(text, offset);
      offset += part.text.length;
      return new TextMatch(part.text, part.isMatch, pieces, breaksBefore);
    });
  }

  private static isBreak(text: string, index: number): boolean {
    const previous = text.charAt(index - 1);
    return previous === Resources.idWordSeparator || (Resources.capitalLetterPattern.test(text.charAt(index)) && !Resources.capitalLetterPattern.test(previous));
  }
}
