/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TextMatch {
  public readonly text: string;
  public readonly isMatch: boolean;

  public constructor(text: string, isMatch: boolean) {
    this.text = text;
    this.isMatch = isMatch;
  }

  public static contains(text: string, query: string): boolean {
    const needle = query.trim().toLocaleLowerCase();
    return needle.length > 0 && text.toLocaleLowerCase().includes(needle);
  }

  public static split(text: string, query: string): readonly TextMatch[] {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length === 0)
      return [new TextMatch(text, false)];
    const parts: TextMatch[] = [];
    const haystack = text.toLocaleLowerCase();
    let start = 0;
    for (let found = haystack.indexOf(needle); found >= 0; found = haystack.indexOf(needle, start)) {
      if (found > start)
        parts.push(new TextMatch(text.slice(start, found), false));
      parts.push(new TextMatch(text.slice(found, found + needle.length), true));
      start = found + needle.length;
    }
    if (start < text.length)
      parts.push(new TextMatch(text.slice(start), false));
    return parts;
  }
}
