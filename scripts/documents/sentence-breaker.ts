/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class SentenceBreaker {
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly PREFIX: RegExp = /^(?:[ \t]*>[ \t]?)*[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?/;
  private static readonly PREFIX_MARKER: RegExp = /[^>\s]/g;
  private static readonly QUOTE: RegExp = /^(?:[ \t]*>[ \t]?)*/;
  private static readonly INDENTED_CODE: RegExp = /^(?: {4}| {0,3}\t)/;
  private static readonly LIST_ITEM: RegExp = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
  private static readonly INDENTED: RegExp = /^[ \t]/;
  private static readonly SETEXT_UNDERLINE: RegExp = /^(?:=+|-+)[ \t]*$/;
  private static readonly FENCE: RegExp = /^(`{3,}|~{3,})/;
  private static readonly FRONT_MATTER: string = "---";
  private static readonly COMMENT_START: string = "<!--";
  private static readonly COMMENT_END: string = "-->";
  private static readonly NOT_PROSE: RegExp = /^(?:#|\||<|\[[^\]]+\]:)/;
  private static readonly TERMINATORS: string = ".?!";
  private static readonly CLOSERS: string = "\"')]*_";
  private static readonly OPENERS: RegExp = /^[(["'*_`]+/;
  private static readonly SENTENCE_START: RegExp = /^[\p{Lu}\d`*_["'(]$/u;
  private static readonly BLOCK_START: RegExp = /^(?:[*][ \t]|\d{1,9}[.)](?:[ \t]|$))/;
  private static readonly TAG_START: RegExp = /^[A-Za-z/!]$/;
  private static readonly ABBREVIATIONS: ReadonlySet<string> = new Set(["e.g.", "i.e.", "etc.", "vs.", "cf.", "No.", "Mr.", "Mrs.", "Ms.", "Dr.", "St."]);
  private static readonly CODE: string = "`";
  private static readonly LINK_TARGET: string = "](";
  private static readonly SPACE: string = " ";

  public format(text: string): string {
    const lines = text.split(SentenceBreaker.LINE_SEPARATOR);
    const prose = SentenceBreaker.findProse(lines);
    return lines.flatMap((t, index) => prose[index] === true ? SentenceBreaker.split(t) : [t]).join(SentenceBreaker.LINE_SEPARATOR);
  }

  public findCrowdedLines(text: string): readonly number[] {
    const lines = text.split(SentenceBreaker.LINE_SEPARATOR);
    const prose = SentenceBreaker.findProse(lines);
    return lines.flatMap((t, index) => prose[index] === true && SentenceBreaker.split(t).length > 1 ? [index + 1] : []);
  }

  private static findProse(lines: readonly string[]): readonly boolean[] {
    const prose: boolean[] = [];
    let fence: string | null = null;
    let isComment = false;
    let isFrontMatter = lines[0] === SentenceBreaker.FRONT_MATTER;
    let isCode = false;
    let isList = false;
    let isAfterBlank = true;
    for (const [index, line] of lines.entries()) {
      const content = line.replace(SentenceBreaker.PREFIX, "");
      const body = line.replace(SentenceBreaker.QUOTE, "");
      const isBlank = content.trim() === "";
      const opening = SentenceBreaker.FENCE.exec(content)?.[1];
      if (isFrontMatter) {
        isFrontMatter = index === 0 || line !== SentenceBreaker.FRONT_MATTER;
        prose.push(false);
      }
      else if (fence !== null) {
        if (opening !== undefined && opening[0] === fence[0] && opening.length >= fence.length && content.trim() === opening)
          fence = null;
        prose.push(false);
      }
      else if (isComment || line.includes(SentenceBreaker.COMMENT_START)) {
        const end = line.lastIndexOf(SentenceBreaker.COMMENT_END);
        isComment = line.lastIndexOf(SentenceBreaker.COMMENT_START) > end || isComment && end === -1;
        prose.push(false);
      }
      else if (isBlank)
        prose.push(false);
      else if ((isCode || isAfterBlank && !isList) && SentenceBreaker.INDENTED_CODE.test(body)) {
        isCode = true;
        prose.push(false);
      }
      else if (SentenceBreaker.SETEXT_UNDERLINE.test(content)) {
        isCode = false;
        for (let previous = index - 1; prose[previous] === true; previous--)
          prose[previous] = false;
        prose.push(false);
      }
      else {
        isCode = false;
        isList = SentenceBreaker.LIST_ITEM.test(body) || isList && (!isAfterBlank || SentenceBreaker.INDENTED.test(body));
        fence = opening ?? null;
        prose.push(fence === null && !SentenceBreaker.NOT_PROSE.test(content));
      }
      isAfterBlank = isBlank;
    }
    return prose;
  }

  private static split(line: string): readonly string[] {
    const content = line.replace(SentenceBreaker.PREFIX, "");
    const prefix = line.slice(0, line.length - content.length);
    const continuation = prefix.replace(SentenceBreaker.PREFIX_MARKER, SentenceBreaker.SPACE);
    const breaks = SentenceBreaker.findBreaks(content);
    return [0, ...breaks.map(t => t + 1)].map((start, index) => `${index === 0 ? prefix : continuation}${content.slice(start, breaks[index])}`);
  }

  private static findBreaks(content: string): readonly number[] {
    const breaks: number[] = [];
    let code = 0;
    let target = 0;
    let isTag = false;
    for (let index = 0; index < content.length; index++) {
      const character = content.charAt(index);
      if (character === SentenceBreaker.CODE) {
        let run = 1;
        while (content.charAt(index + run) === SentenceBreaker.CODE)
          run++;
        code = code === 0 ? run : code === run ? 0 : code;
        index += run - 1;
      }
      else if (code > 0)
        continue;
      else if (target > 0)
        target += character === "(" ? 1 : character === ")" ? -1 : 0;
      else if (isTag)
        isTag = character !== ">";
      else if (content.startsWith(SentenceBreaker.LINK_TARGET, index)) {
        target = 1;
        index++;
      }
      else if (character === "<" && SentenceBreaker.TAG_START.test(content.charAt(index + 1)))
        isTag = true;
      else if (SentenceBreaker.TERMINATORS.includes(character)) {
        let end = index + 1;
        while (end < content.length && SentenceBreaker.CLOSERS.includes(content.charAt(end)))
          end++;
        if (content.charAt(end) === SentenceBreaker.SPACE && SentenceBreaker.SENTENCE_START.test(content.charAt(end + 1))
          && !SentenceBreaker.BLOCK_START.test(content.slice(end + 1)) && !SentenceBreaker.isAbbreviation(content, index))
          breaks.push(end);
      }
    }
    return breaks;
  }

  private static isAbbreviation(content: string, terminator: number): boolean {
    const word = content.slice(content.lastIndexOf(SentenceBreaker.SPACE, terminator) + 1, terminator + 1).replace(SentenceBreaker.OPENERS, "");
    return SentenceBreaker.ABBREVIATIONS.has(word);
  }
}
