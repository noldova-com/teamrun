/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TitleSegment } from "./title-segment";

export class QuickInputItem {
  public readonly id: string;
  public readonly title: string;
  public readonly icon: string | null;
  public readonly detail: string | null;
  public readonly keyLabel: string | null;
  public readonly matches: readonly number[];

  public constructor(id: string, title: string, icon: string | null, detail: string | null, keyLabel: string | null, matches: readonly number[] = []) {
    ArgumentException.throwIfNullOrWhitespace(id, "id");
    ArgumentException.throwIfNullOrWhitespace(title, "title");
    if (matches.some(t => !Number.isInteger(t) || t < 0 || t >= title.length))
      throw new ArgumentException("Each match must be the index of a character of the title.", "matches");

    this.id = id;
    this.title = title;
    this.icon = icon;
    this.detail = detail;
    this.keyLabel = keyLabel;
    this.matches = [...matches];
  }

  public get segments(): readonly TitleSegment[] {
    const matched = new Set(this.matches);
    const segments: TitleSegment[] = [];
    for (let index = 0; index < this.title.length; index++) {
      const isMatch = matched.has(index);
      const last = segments.at(-1);
      if (!Object.isUndefined(last) && last.isMatch === isMatch)
        segments[segments.length - 1] = new TitleSegment(last.text + this.title.charAt(index), isMatch);
      else
        segments.push(new TitleSegment(this.title.charAt(index), isMatch));
    }
    return segments;
  }
}
