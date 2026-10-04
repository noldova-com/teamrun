/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TitleSegment } from "./title-segment";

export class QuickInputItem {
  public readonly id: string;
  public readonly title: string;
  public readonly icon: string | null;
  public readonly detail: string | null;
  public readonly keyLabel: string | null;
  public readonly matches: readonly number[];
  public readonly detailMatches: readonly number[];

  public constructor(id: string, title: string, icon: string | null, detail: string | null, keyLabel: string | null, matches: readonly number[] = [],
    detailMatches: readonly number[] = []) {
    ArgumentException.throwIfNullOrWhitespace(id, "id");
    ArgumentException.throwIfNullOrWhitespace(title, "title");
    if (!QuickInputItem.indexes(matches, title))
      throw new ArgumentException("Each match must be the index of a character of the title.", "matches");
    if (!QuickInputItem.indexes(detailMatches, detail ?? String.empty))
      throw new ArgumentException("Each detail match must be the index of a character of the detail.", "detailMatches");

    this.id = id;
    this.title = title;
    this.icon = icon;
    this.detail = detail;
    this.keyLabel = keyLabel;
    this.matches = [...matches];
    this.detailMatches = [...detailMatches];
  }

  public get segments(): readonly TitleSegment[] {
    return QuickInputItem.segmentsOf(this.title, this.matches);
  }

  public get detailSegments(): readonly TitleSegment[] {
    return QuickInputItem.segmentsOf(this.detail ?? String.empty, this.detailMatches);
  }

  private static indexes(matches: readonly number[], text: string): boolean {
    return matches.every(t => Number.isInteger(t) && t >= 0 && t < text.length);
  }

  private static segmentsOf(text: string, matches: readonly number[]): readonly TitleSegment[] {
    const matched = new Set(matches);
    const segments: TitleSegment[] = [];
    for (let index = 0; index < text.length; index++) {
      const isMatch = matched.has(index);
      const last = segments.at(-1);
      if (!Object.isUndefined(last) && last.isMatch === isMatch)
        segments[segments.length - 1] = new TitleSegment(last.text + text.charAt(index), isMatch);
      else
        segments.push(new TitleSegment(text.charAt(index), isMatch));
    }
    return segments;
  }
}
