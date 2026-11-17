/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TeammateMention } from "../models/teammate-mention.js";
import { MentionSpan } from "../models/mention-span.js";
import { MentionToken } from "../models/mention-token.js";
import { Resources } from "../resources.js";
import { TeammateName } from "./teammate-name.js";

export class MentionResolver {
  public static resolve(text: string, available: readonly TeammateMention[]): readonly TeammateMention[] {
    return MentionResolver.unique(MentionResolver.find(text, available));
  }

  public static resolveTeammateText(text: string, available: readonly TeammateMention[]): readonly TeammateMention[] {
    return MentionResolver.unique(MentionResolver.findIn(text, available, true));
  }

  public static resolveAddressed(text: string, available: readonly TeammateMention[]): readonly TeammateMention[] {
    return MentionResolver.unique(MentionResolver.findAddressed(text, available));
  }

  public static findAddressed(text: string, available: readonly TeammateMention[]): readonly MentionSpan[] {
    const addressed: MentionSpan[] = [];
    for (const span of MentionResolver.findIn(text, available, true)) {
      const lineStart = text.lastIndexOf(Resources.lineSeparator, span.start - 1) + 1;
      const previous = addressed.at(-1);
      const joined = !Object.isUndefined(previous) && previous.start >= lineStart
        && Resources.mentionAddressJoinPattern.test(text.slice(previous.end, span.start));
      if (joined || Resources.mentionAddressLeadPattern.test(text.slice(lineStart, span.start)))
        addressed.push(span);
    }
    return addressed;
  }

  public static find(text: string, available: readonly TeammateMention[]): readonly MentionSpan[] {
    return MentionResolver.findIn(text, available, false);
  }

  public static rewrite(text: string, nameOf: (token: MentionToken) => string): string {
    let result = String.empty;
    let last = 0;
    for (const token of MentionResolver.scan(text, () => null, false).filter(t => t instanceof MentionToken)) {
      result += `${text.slice(last, token.start)}${Resources.mentionMarker}${nameOf(token)}`;
      last = token.end;
    }
    return result + text.slice(last);
  }

  private static unique(spans: readonly MentionSpan[]): readonly TeammateMention[] {
    const result = new Map<string, TeammateMention>();
    for (const span of spans)
      if (!result.has(span.mention.teammateId))
        result.set(span.mention.teammateId, span.mention);
    return [...result.values()];
  }

  private static findIn(text: string, available: readonly TeammateMention[], skipsQuotes: boolean): readonly MentionSpan[] {
    const ids = new Map(available.map(t => [t.teammateId, t]));
    const names = new Map(available.map(t => [TeammateName.key(t.name), t]));
    const firstWords = MentionResolver.firstWordsOf(available);
    const mostWords = Math.max(1, ...[...names.keys()].map(t => t.split(Resources.teammateNameSpace).length));
    const nextWord = new RegExp(Resources.mentionNextWordPattern.source, Resources.mentionNextWordPattern.flags);
    const result: MentionSpan[] = [];
    const hits = MentionResolver.scan(text, (start, match) =>
      MentionResolver.findLongest(text, start, match, names, mostWords, nextWord) ?? MentionResolver.findFirstWord(start, match, firstWords), skipsQuotes);
    for (const hit of hits) {
      if (hit instanceof MentionSpan) {
        result.push(hit);
        continue;
      }
      const mention = ids.get(hit.teammateId);
      if (!Object.isUndefined(mention))
        result.push(new MentionSpan(mention, hit.start, hit.end));
    }
    return result;
  }

  private static scan(text: string, matchName: (start: number, match: RegExpExecArray) => MentionSpan | null,
    skipsQuotes: boolean): readonly (MentionSpan | MentionToken)[] {
    const result: (MentionSpan | MentionToken)[] = [];
    const candidate = new RegExp(Resources.mentionCandidatePattern.source, Resources.mentionCandidatePattern.flags);
    for (let index = 0; index < text.length;) {
      const character = text[index];
      if (character === Resources.mentionEscape) {
        index += 2;
        continue;
      }
      if (character === Resources.mentionBacktick || character === Resources.mentionTilde) {
        let end = index + 1;
        while (text[end] === character)
          end++;
        if (character === Resources.mentionBacktick || end - index >= Resources.mentionFenceLength) {
          index = MentionResolver.afterCode(text, index, end);
          continue;
        }
      }
      if (skipsQuotes) {
        const end = MentionResolver.afterQuote(text, index);
        if (end > index) {
          index = end;
          continue;
        }
      }
      if (character === Resources.mentionTokenStart) {
        const token = MentionToken.at(text, index);
        if (!Object.isNull(token)) {
          result.push(token);
          index = token.end;
          continue;
        }
      }
      if (character === Resources.mentionMarker) {
        candidate.lastIndex = index;
        const match = candidate.exec(text);
        if (!Object.isNull(match)) {
          const span = matchName(index, match);
          if (!Object.isNull(span))
            result.push(span);
          index = Object.isNull(span) ? index + match[0].length : span.end;
          continue;
        }
      }
      index++;
    }
    return result;
  }

  private static firstWordsOf(available: readonly TeammateMention[]): ReadonlyMap<string, TeammateMention | null> {
    const result = new Map<string, TeammateMention | null>();
    for (const mention of available) {
      const word = TeammateName.key(mention.name).split(Resources.teammateNameSpace)[0]!;
      const known = result.get(word);
      result.set(word, Object.isUndefined(known) || known?.teammateId === mention.teammateId ? mention : null);
    }
    return result;
  }

  private static findFirstWord(start: number, match: RegExpExecArray, firstWords: ReadonlyMap<string, TeammateMention | null>): MentionSpan | null {
    const mention = firstWords.get(TeammateName.key(match[1]!));
    return Object.isNullOrUndefined(mention) ? null : new MentionSpan(mention, start, start + match[0].length);
  }

  private static findLongest(text: string, start: number, match: RegExpExecArray, names: ReadonlyMap<string, TeammateMention>, mostWords: number,
    nextWord: RegExp): MentionSpan | null {
    const words: string[] = [];
    let end = start;
    let next: RegExpExecArray | null = match;
    let longest: MentionSpan | null = null;
    while (!Object.isNull(next) && words.length < mostWords) {
      words.push(next[1]!);
      end += next[0].length;
      const teammate = names.get(TeammateName.key(words.join(Resources.teammateNameSpace)));
      if (!Object.isUndefined(teammate))
        longest = new MentionSpan(teammate, start, end);
      nextWord.lastIndex = end;
      next = nextWord.exec(text);
    }
    return longest;
  }

  private static afterQuote(text: string, start: number): number {
    const closers = Resources.mentionQuotes.get(text[start]!);
    if (Object.isUndefined(closers) || MentionResolver.isWordAt(text, start - 1))
      return start;
    const lineEnd = text.indexOf(Resources.lineSeparator, start);
    const end = lineEnd < 0 ? text.length : lineEnd;
    for (let index = start + 1; index < end; index++)
      if (closers.includes(text[index]!) && !MentionResolver.isWordAt(text, index + 1))
        return index + 1;
    return start;
  }

  private static isWordAt(text: string, index: number): boolean {
    return index >= 0 && index < text.length && Resources.mentionQuoteWordPattern.test(text[index]!);
  }

  private static afterCode(text: string, start: number, end: number): number {
    const delimiter = text.slice(start, end);
    let next = text.indexOf(delimiter, end);
    while (next >= 0) {
      let close = next + delimiter.length;
      while (text[close] === delimiter[0])
        close++;
      if (delimiter.length >= Resources.mentionFenceLength || close - next === delimiter.length)
        return close;
      next = text.indexOf(delimiter, close);
    }
    return text.length;
  }
}
