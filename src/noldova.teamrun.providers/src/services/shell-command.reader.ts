/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ShellDialect } from "../enums/shell-dialect.js";
import { Resources } from "../resources.js";

export class ShellCommandReader {
  public static innerCommand(command: string): string | null {
    return ShellCommandReader.callOf(command)?.script ?? null;
  }

  public static dialectOf(command: string): ShellDialect | null {
    return ShellCommandReader.callOf(command)?.dialect ?? null;
  }

  private static callOf(command: string): { dialect: ShellDialect; script: string } | null {
    const words = ShellCommandReader.split(command);
    if (Object.isNull(words) || words.length < 3)
      return null;

    const name = (words[0] as string).split(Resources.pathSeparatorPattern).at(-1) as string;
    const shell = name.toLowerCase().replace(Resources.executableSuffixPattern, String.empty);
    const script = ShellCommandReader.scriptOf(shell, words);
    if (Object.isNull(script))
      return null;
    const isPowerShell = Resources.powerShellNames.includes(shell);
    const inner = isPowerShell ? script.replace(Resources.powerShellEncodingLinePattern, String.empty) : script;
    if (String.isNullOrWhitespace(inner))
      return null;
    const dialect = isPowerShell ? ShellDialect.PowerShell : shell === Resources.cmdShellName ? ShellDialect.Cmd : ShellDialect.Posix;
    return { dialect, script: inner };
  }

  private static scriptOf(shell: string, words: readonly string[]): string | null {
    if (Resources.posixShellNames.includes(shell))
      return words.length === 3 && Resources.posixShellScriptFlags.includes(words[1] as string) ? words[2] as string : null;
    const isPowerShell = Resources.powerShellNames.includes(shell);
    if (!isPowerShell && shell !== Resources.cmdShellName)
      return null;

    const flags = isPowerShell ? Resources.powerShellFlags : Resources.cmdFlags;
    const scriptFlags = isPowerShell ? Resources.powerShellScriptFlags : Resources.cmdScriptFlags;
    for (let index = 1; index < words.length - 1; index++) {
      const flag = (words[index] as string).toLowerCase();
      if (scriptFlags.includes(flag))
        return isPowerShell || index === words.length - 2 ? words.slice(index + 1).join(Resources.space) : null;
      if (!flags.includes(flag))
        return null;
    }

    return null;
  }

  private static split(command: string): string[] | null {
    const words: string[] = [];
    let word = String.empty;
    let inWord = false;
    let quote: string | null = null;
    for (let index = 0; index < command.length; index++) {
      const character = command[index] as string;
      const next = command[index + 1];
      if (Object.isNull(quote) && Resources.shellSpacePattern.test(character)) {
        if (inWord)
          words.push(word);
        word = String.empty;
        inWord = false;
        continue;
      }

      inWord = true;
      if (character === quote)
        quote = null;
      else if (quote === Resources.singleQuote)
        word += character;
      else if (Object.isNull(quote) && (character === Resources.singleQuote || character === Resources.doubleQuote))
        quote = character;
      else if (character === Resources.backslash && !Object.isUndefined(next) && (Object.isNull(quote) || Resources.doubleQuotedEscapes.includes(next)))
        word += command[++index];
      else
        word += character;
    }

    if (!Object.isNull(quote))
      return null;
    if (inWord)
      words.push(word);
    return words;
  }
}
