/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { MatchKind } from "../enums/match-kind";
import { Resources } from "../../resources";
import { CommandMatch } from "./command-match";

export class CommandMatcher {
  public static match(query: string, title: string): CommandMatch | null {
    const wanted = query.trim().toLowerCase();
    const text = title.toLowerCase();
    if (wanted.length === 0)
      return null;
    if (text.startsWith(wanted))
      return new CommandMatch(MatchKind.Prefix, Array.from(wanted, (_, index) => index));
    const atWords = CommandMatcher.matchAtWordStarts(wanted, text);
    if (!Object.isNull(atWords))
      return new CommandMatch(MatchKind.WordStarts, atWords);
    const anywhere = CommandMatcher.matchAnywhere(wanted, text);
    return Object.isNull(anywhere) ? null : new CommandMatch(MatchKind.Subsequence, anywhere);
  }

  private static matchAtWordStarts(wanted: string, text: string, from: number = 0): readonly number[] | null {
    if (wanted.length === 0)
      return [];
    for (let index = from; index < text.length; index++) {
      if (!CommandMatcher.isWordStart(text, index))
        continue;
      let length = 0;
      while (length < wanted.length && text.charAt(index + length) === wanted.charAt(length))
        length++;
      for (; length > 0; length--) {
        const rest = CommandMatcher.matchAtWordStarts(wanted.slice(length), text, index + length);
        if (!Object.isNull(rest))
          return [...Array.from({ length }, (_, offset) => index + offset), ...rest];
      }
    }
    return null;
  }

  private static matchAnywhere(wanted: string, text: string): readonly number[] | null {
    const matches: number[] = [];
    for (let index = 0; index < text.length && matches.length < wanted.length; index++)
      if (text.charAt(index) === wanted.charAt(matches.length))
        matches.push(index);
    return matches.length === wanted.length ? matches : null;
  }

  private static isWordStart(text: string, index: number): boolean {
    return index === 0 || Resources.wordSeparatorPattern.test(text.charAt(index - 1));
  }
}
