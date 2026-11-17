/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ShellDialect } from "../enums/shell-dialect.js";
import { ShellTokenKind } from "../enums/shell-token-kind.js";
import { ShellToken } from "../models/shell-token.js";
import { Resources } from "../resources.js";

export class ShellTokenReader {
  private readonly script: string;
  private readonly dialect: ShellDialect;
  private readonly tokens: ShellToken[] = [];
  private readonly hereDocuments: { readonly delimiter: string; readonly stripsTabs: boolean; readonly expands: boolean; readonly token: number }[] = [];
  private readonly items: ShellToken[] = [];
  private index: number = 0;
  private word: string = String.empty;
  private inWord: boolean = false;
  private isLiteral: boolean = true;
  private isQuoted: boolean = false;
  private runsCommands: boolean = false;
  private startsQuoted: boolean = false;
  private hasBrace: boolean = false;
  private hereDocument: string | null = null;

  private constructor(script: string, dialect: ShellDialect) {
    this.script = script;
    this.dialect = dialect;
  }

  public static tokensOf(script: string, dialect: ShellDialect): readonly ShellToken[] | null {
    return new ShellTokenReader(script, dialect).read();
  }

  private read(): readonly ShellToken[] | null {
    while (this.index < this.script.length) {
      const character = this.script[this.index] as string;
      if (character === Resources.lineSeparator) {
        this.endWord();
        this.tokens.push(new ShellToken(ShellTokenKind.Separator, character));
        this.index += 1;
        if (!this.skipHereDocuments())
          return null;
      }
      else if (Resources.shellBlankPattern.test(character)) {
        this.endWord();
        this.index += 1;
      }
      else if (!this.inWord && this.dialect === ShellDialect.PowerShell && this.script.startsWith(Resources.powerShellBlockCommentStart, this.index)) {
        const end = this.script.indexOf(Resources.powerShellBlockCommentEnd, this.index + Resources.powerShellBlockCommentStart.length);
        if (end < 0)
          return null;
        this.index = end + Resources.powerShellBlockCommentEnd.length;
      }
      else if (!this.inWord && this.dialect !== ShellDialect.Cmd && character === Resources.commentMark) {
        const end = this.script.indexOf(Resources.lineSeparator, this.index);
        this.index = end < 0 ? this.script.length : end;
      }
      else if (!this.readOperator() && !this.readCharacter(character))
        return null;
    }

    this.endWord();
    return this.hereDocuments.length === 0 && Object.isNull(this.hereDocument) ? this.tokens : null;
  }

  private readOperator(): boolean {
    const rest = this.script.slice(this.index);
    const character = rest[0] as string;
    if (this.dialect === ShellDialect.Posix && Resources.processSubstitutionMarks.includes(character) && rest[1] === Resources.openParenthesis)
      return false;
    const redirect = Resources.shellRedirects[this.dialect].find(t => rest.startsWith(t));
    if (!Object.isUndefined(redirect)) {
      const last = this.tokens.at(-1);
      const isDuplicated = last?.kind === ShellTokenKind.Redirect && last.text === Resources.duplicateRedirect;
      if (this.inWord && !this.isQuoted && !isDuplicated && Resources.descriptorPatterns[this.dialect].test(this.word))
        this.resetWord();
      this.endWord();
      this.tokens.push(new ShellToken(ShellTokenKind.Redirect, redirect));
      this.index += redirect.length;
      if (Resources.hereDocumentRedirects.includes(redirect))
        this.hereDocument = redirect;
      return true;
    }
    const separator = Resources.shellSeparators[this.dialect].find(t => rest.startsWith(t));
    const group = Resources.shellGroupCharacters[this.dialect].indexOf(character);
    if (Object.isUndefined(separator) && group < 0)
      return false;
    this.endWord();
    const kind = !Object.isUndefined(separator) ? ShellTokenKind.Separator : group === 0 ? ShellTokenKind.Open : ShellTokenKind.Close;
    const text = separator ?? character;
    this.tokens.push(new ShellToken(kind, text));
    this.index += text.length;
    return true;
  }

  private readCharacter(character: string): boolean {
    this.inWord = true;
    if (Resources.shellGlobCharacters[this.dialect].includes(character)) {
      this.isLiteral = false;
      return this.append(character);
    }
    switch (this.dialect) {
      case ShellDialect.Posix:
        return this.readPosix(character);
      case ShellDialect.PowerShell:
        return this.readPowerShell(character);
      default:
        return this.readCmd(character);
    }
  }

  private readPosix(character: string): boolean {
    switch (character) {
      case Resources.singleQuote:
        return this.readQuoted(character, false);
      case Resources.doubleQuote:
        return this.readDoubleQuoted(Resources.backslash);
      case Resources.backslash:
        return this.readEscaped();
      case Resources.dollarSign:
        return this.readDollar();
      case Resources.backtick:
        return this.readGroup(Resources.backtick, Resources.backtick);
      case Resources.openBrace:
      case Resources.closeBrace:
        this.hasBrace = true;
        return this.append(character);
      default:
        return Resources.processSubstitutionMarks.includes(character) ? this.readGroup(Resources.openParenthesis, Resources.closeParenthesis, 1)
          : this.append(character);
    }
  }

  private readPowerShell(character: string): boolean {
    switch (character) {
      case Resources.singleQuote:
        return this.readQuoted(character, true);
      case Resources.doubleQuote:
        return this.readDoubleQuoted(Resources.backtick);
      case Resources.backtick:
        return this.readEscaped();
      case Resources.dollarSign:
        return this.readDollar();
      case Resources.atSign: {
        const next = this.script[this.index + 1];
        if (next === Resources.openParenthesis || next === Resources.openBrace)
          return this.readGroup(next, next === Resources.openParenthesis ? Resources.closeParenthesis : Resources.closeBrace, 1);
        this.isLiteral = false;
        return this.append(character);
      }
      case Resources.openParenthesis:
        return this.readGroup(Resources.openParenthesis, Resources.closeParenthesis);
      case Resources.openBrace:
        return this.readGroup(Resources.openBrace, Resources.closeBrace);
      case Resources.comma:
        this.items.push(this.item());
        this.resetWord();
        this.inWord = true;
        this.index += 1;
        while (this.index < this.script.length && Resources.shellBlankPattern.test(this.script[this.index] as string))
          this.index += 1;
        return true;
      case Resources.closeParenthesis:
      case Resources.closeBrace:
      case Resources.inputRedirect:
        return false;
      default:
        return this.word.length === 0 && this.script.startsWith(Resources.powerShellStopParsing, this.index) ? false : this.append(character);
    }
  }

  private readCmd(character: string): boolean {
    switch (character) {
      case Resources.doubleQuote: {
        const end = this.script.indexOf(character, this.index + 1);
        if (end < 0)
          return false;
        const quoted = this.script.slice(this.index + 1, end);
        this.isLiteral &&= !quoted.includes(Resources.percentSign);
        this.isQuoted = true;
        this.word += quoted;
        this.index = end + 1;
        return true;
      }
      case Resources.caret:
        return this.readEscaped();
      case Resources.percentSign:
        this.isLiteral = false;
        return this.append(character);
      default:
        return this.append(character);
    }
  }

  private readQuoted(quote: string, doubles: boolean): boolean {
    this.startsQuoted ||= this.word.length === 0;
    let index = this.index + 1;
    while (index < this.script.length) {
      const character = this.script[index] as string;
      if (character === quote && doubles && this.script[index + 1] === quote) {
        this.word += quote;
        index += 2;
      }
      else if (character === quote) {
        this.isQuoted = true;
        this.index = index + 1;
        return true;
      }
      else {
        this.word += character;
        index += 1;
      }
    }

    return false;
  }

  private readDoubleQuoted(escape: string): boolean {
    this.startsQuoted ||= this.word.length === 0;
    this.index += 1;
    while (this.index < this.script.length) {
      const character = this.script[this.index] as string;
      const next = this.script[this.index + 1];
      if (character === Resources.doubleQuote && this.dialect === ShellDialect.PowerShell && next === Resources.doubleQuote) {
        this.word += character;
        this.index += 2;
      }
      else if (character === Resources.doubleQuote) {
        this.isQuoted = true;
        this.index += 1;
        return true;
      }
      else if (character === escape && !Object.isUndefined(next) && (this.dialect === ShellDialect.PowerShell || Resources.doubleQuotedEscapes.includes(next))) {
        if (next !== Resources.lineSeparator)
          this.word += next;
        this.index += 2;
      }
      else if (character === Resources.dollarSign) {
        if (!this.readDollar())
          return false;
      }
      else if (character === Resources.backtick && this.dialect === ShellDialect.Posix) {
        if (!this.readGroup(Resources.backtick, Resources.backtick))
          return false;
      }
      else {
        this.word += character;
        this.index += 1;
      }
    }

    return false;
  }

  private readEscaped(): boolean {
    const next = this.script[this.index + 1];
    if (Object.isUndefined(next))
      return false;
    if (next !== Resources.lineSeparator) {
      this.startsQuoted ||= this.word.length === 0;
      this.word += next;
      this.isQuoted = true;
    }
    else if (this.word.length === 0)
      this.inWord = false;
    this.index += 2;
    return true;
  }

  private readDollar(): boolean {
    const next = this.script[this.index + 1];
    if (next === Resources.openParenthesis)
      return this.readGroup(Resources.openParenthesis, Resources.closeParenthesis, 1);
    if (next === Resources.openBrace)
      return this.readGroup(Resources.openBrace, Resources.closeBrace, 1, false);
    this.isLiteral = false;
    return this.append(Resources.dollarSign);
  }

  private readGroup(open: string, close: string, offset: number = 0, runsCommands: boolean = true): boolean {
    let depth = 0;
    let index = this.index + offset;
    while (index < this.script.length) {
      const character = this.script[index] as string;
      if (index > this.index + offset && character === close && (open === close || depth === 1)) {
        const group = this.script.slice(this.index, index + 1);
        this.isLiteral = false;
        this.runsCommands ||= runsCommands || Resources.substitutionPattern.test(group);
        this.word += group;
        this.index = index + 1;
        return true;
      }
      if (character === open && open !== close)
        depth += 1;
      else if (character === close)
        depth -= 1;
      else if (character === Resources.singleQuote || character === Resources.doubleQuote) {
        const end = this.script.indexOf(character, index + 1);
        if (end < 0)
          return false;
        index = end;
      }
      else if (character === Resources.backslash && this.dialect === ShellDialect.Posix)
        index += 1;
      index += 1;
    }

    return false;
  }

  private append(text: string): boolean {
    this.word += text;
    this.index += 1;
    return true;
  }

  private endWord(): void {
    if (!this.inWord)
      return;
    const items = [...this.items.splice(0), this.item()];
    this.tokens.push(items.length === 1 ? items[0] as ShellToken : ShellToken.word(items.map(t => t.text).join(Resources.comma), false,
      items.some(t => t.isQuoted), items.some(t => t.runsCommands), items));
    if (!Object.isNull(this.hereDocument)) {
      this.hereDocuments.push({ delimiter: this.word, stripsTabs: this.hereDocument === Resources.tabStrippingRedirect, expands: !this.isQuoted,
        token: this.tokens.length - 1 });
      this.hereDocument = null;
    }
    this.resetWord();
  }

  private item(): ShellToken {
    const isGroup = this.word === Resources.openBrace || this.word === Resources.closeBrace;
    const isHome = this.dialect === ShellDialect.Posix && this.startsQuoted && this.word.startsWith(Resources.homeFolder);
    return ShellToken.word(isHome ? `${Resources.currentFolder}${Resources.folderSeparator}${this.word}` : this.word,
      this.isLiteral && (!this.hasBrace || isGroup), this.isQuoted, this.runsCommands);
  }

  private resetWord(): void {
    this.word = String.empty;
    this.inWord = false;
    this.isLiteral = true;
    this.isQuoted = false;
    this.runsCommands = false;
    this.startsQuoted = false;
    this.hasBrace = false;
  }

  private skipHereDocuments(): boolean {
    if (!Object.isNull(this.hereDocument))
      return false;
    for (const document of this.hereDocuments.splice(0)) {
      let runsCommands = false;
      for (;;) {
        if (this.index >= this.script.length)
          return false;
        const end = this.script.indexOf(Resources.lineSeparator, this.index);
        const line = this.script.slice(this.index, end < 0 ? this.script.length : end).replace(Resources.trailingCarriageReturnPattern, String.empty);
        this.index = end < 0 ? this.script.length : end + 1;
        if ((document.stripsTabs ? line.replace(Resources.leadingTabsPattern, String.empty) : line) === document.delimiter)
          break;
        runsCommands ||= document.expands && Resources.substitutionPattern.test(line);
      }
      const token = this.tokens[document.token] as ShellToken;
      if (runsCommands)
        this.tokens[document.token] = ShellToken.word(token.text, token.isLiteral, token.isQuoted, true);
    }

    return true;
  }
}
