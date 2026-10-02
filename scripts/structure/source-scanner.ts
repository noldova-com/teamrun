/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ScannedSource from "./scanned-source.ts";
import SourceLiteral from "./source-literal.ts";

export default class SourceScanner {
  private static readonly LINE_FEED: string = "\n";
  private static readonly BACKSLASH: string = "\\";
  private static readonly BACKTICK: string = "`";
  private static readonly SUBSTITUTION_START: string = "${";
  private static readonly LINE_COMMENT_START: string = "//";
  private static readonly BLOCK_COMMENT_START: string = "/*";
  private static readonly BLOCK_COMMENT_END: string = "*/";
  private static readonly SLASH: string = "/";
  private static readonly OPENING_BRACE: string = "{";
  private static readonly CLOSING_BRACE: string = "}";
  private static readonly OPENING_BRACKET: string = "[";
  private static readonly CLOSING_BRACKET: string = "]";
  private static readonly OPENING_PARENTHESIS: string = "(";
  private static readonly COLON: string = ":";
  private static readonly OPERAND: string = "0";
  private static readonly QUOTES: ReadonlySet<string> = new Set(["\"", "'"]);
  private static readonly WHITESPACE: RegExp = /\s/;
  private static readonly IDENTIFIER_START: RegExp = /[A-Za-z_$]/;
  private static readonly WORD_PART: RegExp = /[\w$]/;
  private static readonly DIGIT: RegExp = /\d/;
  private static readonly OPERAND_END: RegExp = /[\w$)\]]$/;
  private static readonly REGULAR_EXPRESSION_KEYWORDS: ReadonlySet<string> = new Set([
    "await", "case", "delete", "do", "else", "in", "instanceof", "new", "of", "return", "throw", "typeof", "void", "yield"
  ]);
  private static readonly IMPORT_KEYWORDS: ReadonlySet<string> = new Set(["from", "import"]);
  private static readonly IMPORT_CALLS: ReadonlySet<string> = new Set(["import", "require"]);
  private static readonly SELECTOR_KEY: string = "selector";

  private readonly text: string;
  private readonly imports: SourceLiteral[] = [];
  private readonly selectors: SourceLiteral[] = [];
  private readonly texts: SourceLiteral[] = [];
  private readonly substitutionDepths: number[] = [];
  private position: number = 0;
  private line: number = 1;
  private braceDepth: number = 0;
  private previousToken: string | null = null;
  private earlierToken: string | null = null;

  public constructor(text: string) {
    this.text = text;
  }

  public scan(): ScannedSource {
    while (this.position < this.text.length)
      this.scanNext(this.text.charAt(this.position));
    return new ScannedSource(this.imports, this.selectors, this.texts);
  }

  private scanNext(character: string): void {
    if (character === SourceScanner.LINE_FEED) {
      this.line++;
      this.position++;
    } else if (SourceScanner.WHITESPACE.test(character))
      this.position++;
    else if (this.text.startsWith(SourceScanner.LINE_COMMENT_START, this.position))
      this.skipLineComment();
    else if (this.text.startsWith(SourceScanner.BLOCK_COMMENT_START, this.position))
      this.skipBlockComment();
    else if (SourceScanner.QUOTES.has(character))
      this.readString(character);
    else if (character === SourceScanner.BACKTICK) {
      this.position++;
      this.readTemplate();
    } else if (character === SourceScanner.SLASH && this.allowsRegularExpression())
      this.readRegularExpression();
    else if (SourceScanner.IDENTIFIER_START.test(character))
      this.pushToken(this.readWord());
    else if (SourceScanner.DIGIT.test(character)) {
      this.readWord();
      this.pushToken(SourceScanner.OPERAND);
    } else
      this.readPunctuator(character);
  }

  private skipLineComment(): void {
    const end = this.text.indexOf(SourceScanner.LINE_FEED, this.position);
    this.position = end < 0 ? this.text.length : end;
  }

  private skipBlockComment(): void {
    const end = this.text.indexOf(SourceScanner.BLOCK_COMMENT_END, this.position + SourceScanner.BLOCK_COMMENT_START.length);
    const next = end < 0 ? this.text.length : end + SourceScanner.BLOCK_COMMENT_END.length;
    this.line += this.text.slice(this.position, next).split(SourceScanner.LINE_FEED).length - 1;
    this.position = next;
  }

  private readString(quote: string): void {
    const line = this.line;
    let value = "";
    this.position++;
    while (this.position < this.text.length) {
      const character = this.text.charAt(this.position);
      if (character === quote || character === SourceScanner.LINE_FEED)
        break;
      if (character === SourceScanner.BACKSLASH) {
        const escaped = this.text.charAt(this.position + 1);
        if (escaped === SourceScanner.LINE_FEED)
          this.line++;
        else
          value += escaped;
        this.position += 2;
        continue;
      }
      value += character;
      this.position++;
    }
    if (this.text.charAt(this.position) === quote)
      this.position++;
    this.classify(new SourceLiteral(value, line));
    this.pushToken(SourceScanner.OPERAND);
  }

  private readTemplate(): void {
    const line = this.line;
    let value = "";
    while (this.position < this.text.length) {
      const character = this.text.charAt(this.position);
      if (character === SourceScanner.BACKTICK) {
        this.position++;
        break;
      }
      if (this.text.startsWith(SourceScanner.SUBSTITUTION_START, this.position)) {
        this.position += SourceScanner.SUBSTITUTION_START.length;
        this.substitutionDepths.push(this.braceDepth);
        this.texts.push(new SourceLiteral(value, line));
        this.pushToken(SourceScanner.OPENING_BRACE);
        return;
      }
      if (character === SourceScanner.LINE_FEED)
        this.line++;
      if (character === SourceScanner.BACKSLASH) {
        value += this.text.charAt(this.position + 1);
        this.position += 2;
        continue;
      }
      value += character;
      this.position++;
    }
    this.texts.push(new SourceLiteral(value, line));
    this.pushToken(SourceScanner.OPERAND);
  }

  private readRegularExpression(): void {
    let isInClass = false;
    this.position++;
    while (this.position < this.text.length) {
      const character = this.text.charAt(this.position);
      if (character === SourceScanner.LINE_FEED)
        break;
      this.position += character === SourceScanner.BACKSLASH ? 2 : 1;
      if (character === SourceScanner.OPENING_BRACKET)
        isInClass = true;
      else if (character === SourceScanner.CLOSING_BRACKET)
        isInClass = false;
      else if (character === SourceScanner.SLASH && !isInClass)
        break;
    }
    this.readWord();
    this.pushToken(SourceScanner.OPERAND);
  }

  private readWord(): string {
    const start = this.position;
    while (this.position < this.text.length && SourceScanner.WORD_PART.test(this.text.charAt(this.position)))
      this.position++;
    return this.text.slice(start, this.position);
  }

  private readPunctuator(character: string): void {
    this.position++;
    if (character === SourceScanner.CLOSING_BRACE && this.substitutionDepths.at(-1) === this.braceDepth) {
      this.substitutionDepths.pop();
      this.readTemplate();
      return;
    }
    if (character === SourceScanner.OPENING_BRACE)
      this.braceDepth++;
    else if (character === SourceScanner.CLOSING_BRACE)
      this.braceDepth--;
    this.pushToken(character);
  }

  private allowsRegularExpression(): boolean {
    if (this.previousToken === null || SourceScanner.REGULAR_EXPRESSION_KEYWORDS.has(this.previousToken))
      return true;
    return !SourceScanner.OPERAND_END.test(this.previousToken);
  }

  private classify(literal: SourceLiteral): void {
    if (this.isImportSpecifier())
      this.imports.push(literal);
    else if (this.previousToken === SourceScanner.COLON && this.earlierToken === SourceScanner.SELECTOR_KEY)
      this.selectors.push(literal);
    else
      this.texts.push(literal);
  }

  private isImportSpecifier(): boolean {
    if (this.previousToken !== null && SourceScanner.IMPORT_KEYWORDS.has(this.previousToken))
      return true;
    return this.previousToken === SourceScanner.OPENING_PARENTHESIS && this.earlierToken !== null && SourceScanner.IMPORT_CALLS.has(this.earlierToken);
  }

  private pushToken(token: string): void {
    this.earlierToken = this.previousToken;
    this.previousToken = token;
  }
}
