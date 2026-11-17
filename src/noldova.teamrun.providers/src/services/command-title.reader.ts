/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { CommandKind } from "../enums/command-kind.js";
import { ShellDialect } from "../enums/shell-dialect.js";
import type { CmdletParameters } from "../models/cmdlet-parameters.js";
import type { CommandFlags } from "../models/command-flags.js";
import { Resources } from "../resources.js";
import { ShellCommandReader } from "./shell-command.reader.js";

export class CommandTitleReader {
  public static titleOfCall(command: string): string | null {
    const dialect = ShellCommandReader.dialectOf(command);
    const script = ShellCommandReader.innerCommand(command);
    return Object.isNull(dialect) || Object.isNull(script) ? null : CommandTitleReader.titleOf(script, dialect);
  }

  public static titleOf(command: string, dialect: ShellDialect): string | null {
    const words = CommandTitleReader.wordsOf(command, dialect);
    if (Object.isNull(words) || words.length === 0 || CommandTitleReader.isRelativePath(words[0] as string))
      return null;

    const base = (words[0] as string).split(Resources.pathSeparatorPattern).at(-1) as string;
    const name = (dialect === ShellDialect.Posix ? base : base.toLowerCase()).replace(Resources.executableSuffixPattern, String.empty);
    const args = words.slice(1);
    switch (Resources.commandKinds[dialect].get(name)) {
      case CommandKind.Search:
        return CommandTitleReader.searchOf(name, args);
      case CommandKind.Read:
        return dialect === ShellDialect.PowerShell ? CommandTitleReader.contentOf(args) : CommandTitleReader.filesOf(args);
      case CommandKind.ReadStart:
        return CommandTitleReader.partOf(args, Resources.formatReadStartTitle);
      case CommandKind.ReadEnd:
        return CommandTitleReader.partOf(args, Resources.formatReadEndTitle);
      case CommandKind.List:
        return CommandTitleReader.listOf(args, dialect);
      case CommandKind.ChangeFolder:
        return CommandTitleReader.folderOf(args, dialect);
      case CommandKind.Git:
        return CommandTitleReader.gitOf(args);
      default:
        return null;
    }
  }

  private static wordsOf(command: string, dialect: ShellDialect): string[] | null {
    if (Resources.shellLineBreakPattern.test(command))
      return null;

    const operators = Resources.shellOperators[dialect];
    const refused = Resources.shellQuotedRefused[dialect];
    const quotes = dialect === ShellDialect.Cmd ? Resources.doubleQuote : `${Resources.singleQuote}${Resources.doubleQuote}`;
    const words: string[] = [];
    let word = String.empty;
    let inWord = false;
    let quote: string | null = null;
    for (let index = 0; index < command.length; index++) {
      const character = command[index] as string;
      const next = command[index + 1];
      if (Object.isNull(quote)) {
        if (Resources.shellSpacePattern.test(character)) {
          if (inWord)
            words.push(word);
          word = String.empty;
          inWord = false;
          continue;
        }
        if (operators.includes(character) || (!inWord && dialect !== ShellDialect.Cmd && character === Resources.commentMark))
          return null;
        inWord = true;
        if (quotes.includes(character))
          quote = character;
        else if (dialect === ShellDialect.Posix && character === Resources.backslash) {
          if (Object.isUndefined(next))
            return null;
          word += next;
          index += 1;
        }
        else
          word += character;
        continue;
      }
      if (character === quote && dialect === ShellDialect.PowerShell && quote === Resources.singleQuote && next === Resources.singleQuote) {
        word += character;
        index += 1;
      }
      else if (character === quote)
        quote = null;
      else if (dialect === ShellDialect.Posix && quote === Resources.doubleQuote && character === Resources.backslash && !Object.isUndefined(next)
        && Resources.doubleQuotedEscapes.includes(next)) {
        word += next;
        index += 1;
      }
      else if (quote === Resources.doubleQuote && refused.includes(character))
        return null;
      else
        word += character;
    }

    if (!Object.isNull(quote))
      return null;
    if (inWord)
      words.push(word);
    return words;
  }

  private static isRelativePath(word: string): boolean {
    return Resources.pathSeparatorPattern.test(word) && !Resources.absoluteCommandPattern.test(word);
  }

  private static searchOf(name: string, args: readonly string[]): string | null {
    const flags = Resources.searchFlags.get(name);
    const search = !Object.isUndefined(flags) ? CommandTitleReader.flaggedSearchOf(args, flags)
      : name === Resources.findstrName ? CommandTitleReader.findstrOf(args) : CommandTitleReader.selectStringOf(args);
    return Object.isNull(search) ? null : Resources.formatSearchedTitle(search.pattern, search.paths);
  }

  private static flaggedSearchOf(args: readonly string[], flags: CommandFlags): { pattern: string; paths: readonly string[] } | null {
    let pattern: string | null = null;
    const paths: string[] = [];
    let isEnded = false;
    for (let index = 0; index < args.length; index++) {
      const arg = args[index] as string;
      if (arg === Resources.flagPrefix)
        return null;
      if (isEnded || !arg.startsWith(Resources.flagPrefix)) {
        if (Object.isNull(pattern))
          pattern = arg;
        else
          paths.push(arg);
        continue;
      }
      if (arg === Resources.longFlagPrefix) {
        isEnded = true;
        continue;
      }
      if (arg.startsWith(Resources.longFlagPrefix)) {
        const separator = arg.indexOf(Resources.flagValueSeparator);
        const flag = separator < 0 ? arg : arg.slice(0, separator);
        const value = separator < 0 ? args[index + 1] : arg.slice(separator + 1);
        const step = separator < 0 ? 1 : 0;
        if (flag === flags.patternName && Object.isNull(pattern) && !Object.isUndefined(value)) {
          pattern = value;
          index += step;
        }
        else if (flags.valueNames.includes(flag) && !Object.isUndefined(value))
          index += step;
        else if (!flags.names.includes(flag) || separator >= 0)
          return null;
        continue;
      }
      for (let at = 1; at < arg.length; at++) {
        const letter = arg[at] as string;
        const rest = arg.slice(at + 1);
        const value = rest.length > 0 ? rest : args[index + 1];
        const step = rest.length > 0 ? 0 : 1;
        if (letter === flags.patternLetter && Object.isNull(pattern) && !Object.isUndefined(value)) {
          pattern = value;
          index += step;
          break;
        }
        if (flags.valueLetters.includes(letter) && !Object.isUndefined(value)) {
          index += step;
          break;
        }
        if (!flags.letters.includes(letter))
          return null;
      }
    }

    return Object.isNull(pattern) ? null : { pattern, paths };
  }

  private static findstrOf(args: readonly string[]): { pattern: string; paths: readonly string[] } | null {
    let literal: string | null = null;
    const positional: string[] = [];
    for (const arg of args) {
      const lower = arg.toLowerCase();
      if (lower.startsWith(Resources.findstrLiteralPrefix) && Object.isNull(literal))
        literal = arg.slice(Resources.findstrLiteralPrefix.length);
      else if (lower.startsWith(Resources.switchPrefix)) {
        if (!Resources.findstrSwitches.includes(lower))
          return null;
      }
      else
        positional.push(arg);
    }

    const pattern = literal ?? positional.shift();
    if (Object.isUndefined(pattern) || pattern.length === 0 || (Object.isNull(literal) && Resources.shellSpacePattern.test(pattern)))
      return null;
    return { pattern, paths: positional };
  }

  private static selectStringOf(args: readonly string[]): { pattern: string; paths: readonly string[] } | null {
    const call = CommandTitleReader.cmdletOf(args, Resources.selectStringParameters);
    if (Object.isNull(call))
      return null;
    const positional = [...call.positional];
    const pattern = call.named.get(Resources.patternParameter) ?? positional.shift();
    const path = CommandTitleReader.pathOf(call.named) ?? positional.shift();
    if (Object.isUndefined(pattern) || positional.length > 0)
      return null;
    return { pattern, paths: Object.isUndefined(path) ? [] : [path] };
  }

  private static filesOf(args: readonly string[]): string | null {
    if (args.length === 0 || args.some(t => t.startsWith(Resources.flagPrefix) || t.startsWith(Resources.switchPrefix)))
      return null;
    return Resources.formatReadTitle(args);
  }

  private static contentOf(args: readonly string[]): string | null {
    const call = CommandTitleReader.cmdletOf(args, Resources.getContentParameters);
    if (Object.isNull(call))
      return null;
    const positional = [...call.positional];
    const path = CommandTitleReader.pathOf(call.named) ?? positional.shift();
    const isStart = Resources.startParameters.some(t => call.named.has(t));
    const isEnd = Resources.endParameters.some(t => call.named.has(t));
    if (Object.isUndefined(path) || positional.length > 0 || (isStart && isEnd))
      return null;
    if (isStart)
      return Resources.formatReadStartTitle(path);
    return isEnd ? Resources.formatReadEndTitle(path) : Resources.formatReadTitle([path]);
  }

  private static partOf(args: readonly string[], format: (file: string) => string): string | null {
    const files: string[] = [];
    for (let index = 0; index < args.length; index++) {
      const arg = args[index] as string;
      if (Resources.partValueFlags.includes(arg) && !Object.isUndefined(args[index + 1]))
        index += 1;
      else if (arg.startsWith(Resources.flagPrefix) && !Resources.partFlagPattern.test(arg))
        return null;
      else if (!arg.startsWith(Resources.flagPrefix))
        files.push(arg);
    }

    return files.length === 1 ? format(files[0] as string) : null;
  }

  private static listOf(args: readonly string[], dialect: ShellDialect): string | null {
    const listing = dialect === ShellDialect.PowerShell ? CommandTitleReader.childItemsOf(args)
      : dialect === ShellDialect.Cmd ? CommandTitleReader.dirOf(args) : CommandTitleReader.lsOf(args);
    if (Object.isNull(listing))
      return null;
    if (Object.isNull(listing.path))
      return listing.isRecursive ? Resources.listedTreeTitle : Resources.listedFolderTitle;
    return listing.isRecursive ? Resources.formatListedTreeTitle(listing.path) : Resources.formatListedTitle(listing.path);
  }

  private static lsOf(args: readonly string[]): { path: string | null; isRecursive: boolean } | null {
    const paths: string[] = [];
    let isRecursive = false;
    for (const arg of args) {
      if (arg.startsWith(Resources.longFlagPrefix)) {
        if (!Resources.listNames.includes(arg.split(Resources.flagValueSeparator)[0] as string))
          return null;
      }
      else if (arg.startsWith(Resources.flagPrefix) && arg.length > 1) {
        for (const letter of arg.slice(1))
          if (letter === Resources.recurseLetter)
            isRecursive = true;
          else if (!Resources.listLetters.includes(letter))
            return null;
      }
      else
        paths.push(arg);
    }

    return paths.length > 1 ? null : { path: paths[0] ?? null, isRecursive };
  }

  private static dirOf(args: readonly string[]): { path: string | null; isRecursive: boolean } | null {
    const paths: string[] = [];
    let isRecursive = false;
    for (const arg of args) {
      const lower = arg.toLowerCase();
      if (lower === Resources.dirRecurseSwitch)
        isRecursive = true;
      else if (lower.startsWith(Resources.switchPrefix)) {
        if (!Resources.dirSwitches.includes(lower) && !Resources.dirValueSwitches.some(t => lower.startsWith(t)))
          return null;
      }
      else
        paths.push(arg);
    }

    return paths.length > 1 ? null : { path: paths[0] ?? null, isRecursive };
  }

  private static childItemsOf(args: readonly string[]): { path: string | null; isRecursive: boolean } | null {
    const call = CommandTitleReader.cmdletOf(args, Resources.getChildItemParameters);
    if (Object.isNull(call))
      return null;
    const positional = [...call.positional];
    const path = CommandTitleReader.pathOf(call.named) ?? positional.shift() ?? null;
    if (positional.length > 0)
      return null;
    return { path, isRecursive: call.switches.includes(Resources.recurseParameter) || call.named.has(Resources.depthParameter) };
  }

  private static folderOf(args: readonly string[], dialect: ShellDialect): string | null {
    if (dialect === ShellDialect.PowerShell) {
      const call = CommandTitleReader.cmdletOf(args, Resources.setLocationParameters);
      if (Object.isNull(call))
        return null;
      const path = CommandTitleReader.pathOf(call.named) ?? call.positional[0];
      if (Object.isUndefined(path) || call.positional.length + call.named.size !== 1)
        return null;
      return Resources.formatChangedFolderTitle(path);
    }

    const shown = dialect === ShellDialect.Cmd ? args.filter(t => t.toLowerCase() !== Resources.driveSwitch) : args;
    const path = shown[0];
    if (shown.length !== 1 || Object.isUndefined(path) || path.startsWith(Resources.flagPrefix) || path.startsWith(Resources.switchPrefix))
      return null;
    return Resources.formatChangedFolderTitle(path);
  }

  private static gitOf(args: readonly string[]): string | null {
    const shown = args[0] === Resources.gitNoPagerFlag ? args.slice(1) : args;
    const title = Resources.gitTitles.get(shown[0] ?? String.empty);
    if (Object.isUndefined(title) || shown.some(t => t.startsWith(Resources.gitOutputFlag)))
      return null;
    return title;
  }

  private static cmdletOf(args: readonly string[], parameters: CmdletParameters)
    : { named: ReadonlyMap<string, string>; switches: readonly string[]; positional: readonly string[] } | null {
    const named = new Map<string, string>();
    const switches: string[] = [];
    const positional: string[] = [];
    for (let index = 0; index < args.length; index++) {
      const arg = args[index] as string;
      if (!arg.startsWith(Resources.flagPrefix) || arg.length === 1) {
        positional.push(arg);
        continue;
      }
      const name = arg.toLowerCase();
      const value = args[index + 1];
      if (parameters.switches.includes(name))
        switches.push(name);
      else if (parameters.values.includes(name) && !Object.isUndefined(value) && !named.has(name)) {
        named.set(name, value);
        index += 1;
      }
      else
        return null;
    }

    return { named, switches, positional };
  }

  private static pathOf(named: ReadonlyMap<string, string>): string | undefined {
    return Resources.pathParameters.map(t => named.get(t)).find(t => !Object.isUndefined(t));
  }
}
