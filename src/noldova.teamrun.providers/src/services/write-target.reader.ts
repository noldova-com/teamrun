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
import { WriteKind } from "../enums/write-kind.js";
import type { CmdletParameters } from "../models/cmdlet-parameters.js";
import type { CommandFlags } from "../models/command-flags.js";
import { ShellToken } from "../models/shell-token.js";
import { WriteTargets } from "../models/write-targets.js";
import { Resources } from "../resources.js";
import { ShellCommandReader } from "./shell-command.reader.js";
import { ShellTokenReader } from "./shell-token.reader.js";

export class WriteTargetReader {
  private readonly dialect: ShellDialect;
  private readonly files: Set<string> = new Set();
  private readonly unnamedIn: Set<string> = new Set();
  private readonly groups: string[] = [];
  private readonly pushed: string[] = [];
  private folder: string = String.empty;

  private constructor(dialect: ShellDialect) {
    this.dialect = dialect;
  }

  public static targetsOfCall(command: string): WriteTargets | null {
    const dialect = ShellCommandReader.dialectOf(command);
    const script = ShellCommandReader.innerCommand(command);
    return Object.isNull(dialect) || Object.isNull(script) ? null : WriteTargetReader.targetsOf(script, dialect);
  }

  public static targetsOfCommand(command: string, platform: string = process.platform): WriteTargets | null {
    return WriteTargetReader.targetsOfCall(command)
      ?? WriteTargetReader.targetsOf(command, platform === Resources.windowsPlatform ? ShellDialect.PowerShell : ShellDialect.Posix);
  }

  public static targetsOf(script: string, dialect: ShellDialect): WriteTargets | null {
    const tokens = ShellTokenReader.tokensOf(script, dialect);
    return Object.isNull(tokens) ? null : new WriteTargetReader(dialect).read(tokens);
  }

  private read(tokens: readonly ShellToken[]): WriteTargets | null {
    let words: ShellToken[] = [];
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index] as ShellToken;
      if (token.kind === ShellTokenKind.Word) {
        words.push(token);
        continue;
      }
      if (token.kind === ShellTokenKind.Redirect) {
        const target = tokens[index + 1];
        if (Object.isUndefined(target) || target.kind !== ShellTokenKind.Word)
          return null;
        this.redirect(token.text, target);
        index += 1;
        continue;
      }
      if (!this.command(words))
        return null;
      words = [];
      if (token.kind === ShellTokenKind.Open)
        this.groups.push(this.folder);
      else if (token.kind === ShellTokenKind.Close) {
        const folder = this.groups.pop();
        if (Object.isUndefined(folder))
          return null;
        if (this.dialect !== ShellDialect.Cmd)
          this.folder = folder;
      }
    }

    return this.command(words) && this.groups.length === 0 ? new WriteTargets([...this.files], [...this.unnamedIn]) : null;
  }

  private redirect(operator: string, target: ShellToken): void {
    if (target.runsCommands)
      this.unnamed();
    if (!Resources.writingRedirects.includes(operator) || (operator === Resources.duplicateRedirect && Resources.duplicateTargetPattern.test(target.text)))
      return;
    this.write(target);
  }

  private command(words: readonly ShellToken[]): boolean {
    if (words.some(t => t.runsCommands))
      this.unnamed();
    let start = 0;
    while (this.dialect === ShellDialect.Posix && start < words.length && Resources.assignmentPattern.test((words[start] as ShellToken).text))
      start += 1;
    const first = words[start];
    if (Object.isUndefined(first) || (this.dialect === ShellDialect.PowerShell && first.isQuoted && !first.text.includes(Resources.subexpressionStart)))
      return true;
    if (!first.isLiteral && !Resources.testBrackets.includes(first.text)) {
      this.unnamed();
      return true;
    }

    const base = first.text.split(Resources.pathSeparatorPattern).at(-1) as string;
    const name = this.dialect === ShellDialect.Posix ? base : base.toLowerCase().replace(Resources.executableSuffixPattern, String.empty);
    const args = words.slice(start + 1);
    if (this.dialect === ShellDialect.Posix && Resources.shellLeadingKeywords.includes(name))
      return this.command(args);
    const kind = Resources.writeKinds[this.dialect].get(name);
    if (Object.isUndefined(kind)) {
      this.unnamed();
      return true;
    }
    if (kind === WriteKind.Quiet)
      return true;
    if (kind === WriteKind.Git) {
      this.git(args);
      return true;
    }
    if (this.dialect === ShellDialect.PowerShell)
      return this.cmdlet(kind, name, args);
    if (this.dialect === ShellDialect.Cmd)
      return this.cmd(kind, args);
    return this.posix(kind, name, args);
  }

  private posix(kind: WriteKind, name: string, args: readonly ShellToken[]): boolean {
    const { operands, options } = WriteTargetReader.optionsOf(args, Resources.writeFlags.get(name) ?? Resources.noFlags);
    const has = (flags: readonly string[]): boolean => flags.some(t => options.has(t));
    const valueOf = (flags: readonly string[]): ShellToken | null => flags.map(t => options.get(t)).find(t => !Object.isNullOrUndefined(t)) ?? null;
    switch (kind) {
      case WriteKind.ChangeFolder:
        return this.changeFolder(operands[0] ?? null);
      case WriteKind.PushFolder:
        this.pushed.push(this.folder);
        return operands.length > 0 && this.changeFolder(operands[0] as ShellToken);
      case WriteKind.PopFolder:
        return this.popFolder();
      case WriteKind.Files:
        operands.forEach(t => this.write(t));
        return true;
      case WriteKind.Copy:
      case WriteKind.Move: {
        const folder = valueOf(Resources.targetFolderFlags);
        const sources = Object.isNull(folder) ? operands.slice(0, -1) : operands;
        const destination = folder ?? operands.at(-1);
        if (Object.isUndefined(destination) || sources.length === 0) {
          this.unnamed();
          return true;
        }
        this.copy(sources, destination, kind === WriteKind.Move, has(Resources.recursiveFlags));
        return true;
      }
      case WriteKind.Remove:
        this.remove(operands, has(Resources.recursiveFlags));
        return true;
      case WriteKind.StreamEdit:
        if (has(Resources.inPlaceFlags))
          (has(Resources.scriptFlags) ? operands : operands.slice(1)).forEach(t => this.write(t));
        return true;
      case WriteKind.DiskDump:
        for (const operand of operands.filter(t => t.text.startsWith(Resources.diskDumpOutputPrefix)))
          this.write(ShellToken.word(operand.text.slice(Resources.diskDumpOutputPrefix.length), operand.isLiteral));
        return true;
      case WriteKind.Sort:
      case WriteKind.Download: {
        const output = valueOf(Resources.outputFlags);
        const folder = valueOf(Resources.outputFolderFlags);
        if (!Object.isNull(output) && output.text !== Resources.standardStream)
          this.write(Object.isNull(folder) ? output : WriteTargetReader.within(folder, output));
        if (kind !== WriteKind.Download || !has(Resources.remoteNameFlags))
          return true;
        if (Object.isNull(folder))
          this.unnamed();
        else
          this.unnamedAt(folder);
        return true;
      }
      case WriteKind.Fetch: {
        const output = valueOf(Resources.outputDocumentFlags);
        if (Object.isNull(output))
          this.unnamed();
        else if (output.text !== Resources.standardStream)
          this.write(output);
        return true;
      }
      default:
        if (args.some(t => Resources.findWritingActions.includes(t.text)))
          this.unnamed();
        return true;
    }
  }

  private cmdlet(kind: WriteKind, name: string, args: readonly ShellToken[]): boolean {
    const call = WriteTargetReader.parametersOf(args, Resources.cmdletWriteParameters.get(name) as CmdletParameters);
    if (Object.isNull(call) || Resources.wildcardParameters.some(t => call.named.has(t))) {
      this.unnamed();
      return true;
    }
    const positional = [...call.positional];
    const named = (parameters: readonly string[]): ShellToken | undefined => parameters.map(t => call.named.get(t)).find(t => !Object.isUndefined(t));
    const path = named(Resources.fileParameters) ?? positional.shift();
    switch (kind) {
      case WriteKind.ChangeFolder:
        return this.changeFolder(path ?? null);
      case WriteKind.PushFolder:
        this.pushed.push(this.folder);
        return Object.isUndefined(path) || this.changeFolder(path);
      case WriteKind.PopFolder:
        return this.popFolder();
      case WriteKind.Files:
        if (!Object.isUndefined(path) && !call.named.has(Resources.variableParameter))
          this.write(path);
        return true;
      case WriteKind.NewItem: {
        const type = named(Resources.itemTypeParameters);
        if (!Object.isUndefined(type) && type.text.toLowerCase() === Resources.folderItemType)
          return true;
        const leaf = call.named.get(Resources.nameParameter);
        const folder = path ?? ShellToken.word(Resources.currentFolder);
        if (Object.isUndefined(leaf))
          this.write(folder);
        else
          this.write(WriteTargetReader.within(folder, leaf));
        return true;
      }
      case WriteKind.Copy:
      case WriteKind.Move:
        if (Object.isUndefined(path)) {
          this.unnamed();
          return true;
        }
        this.copy([path], call.named.get(Resources.destinationParameter) ?? positional.shift() ?? ShellToken.word(Resources.currentFolder),
          kind === WriteKind.Move, call.switches.includes(Resources.recurseParameter));
        return true;
      case WriteKind.Remove:
        this.remove([...Object.isUndefined(path) ? [] : [path], ...positional], call.switches.includes(Resources.recurseParameter));
        return true;
      default:
        return this.rename(path, call.named.get(Resources.newNameParameter) ?? positional.shift());
    }
  }

  private cmd(kind: WriteKind, args: readonly ShellToken[]): boolean {
    const switches = args.filter(t => t.isLiteral && Resources.cmdSwitchPattern.test(t.text)).map(t => t.text.toLowerCase());
    const operands = args.filter(t => !t.isLiteral || !Resources.cmdSwitchPattern.test(t.text));
    switch (kind) {
      case WriteKind.ChangeFolder:
        return operands.length === 0 || this.changeFolder(operands[0] as ShellToken);
      case WriteKind.PushFolder:
        if (operands.length === 0)
          return true;
        this.pushed.push(this.folder);
        return this.changeFolder(operands[0] as ShellToken);
      case WriteKind.PopFolder:
        return this.popFolder();
      case WriteKind.Copy:
      case WriteKind.Move: {
        const source = operands[0];
        if (Object.isUndefined(source) || operands.length > 2) {
          this.unnamed();
          return true;
        }
        this.copy([source], operands[1] ?? ShellToken.word(Resources.currentFolder), kind === WriteKind.Move, false);
        return true;
      }
      case WriteKind.Remove:
        this.remove(operands, switches.includes(Resources.dirRecurseSwitch));
        return true;
      default:
        return this.rename(operands[0], operands[1]);
    }
  }

  private git(args: readonly ShellToken[]): void {
    let folder: ShellToken | null = null;
    let index = 0;
    while (index < args.length && (args[index] as ShellToken).text.startsWith(Resources.flagPrefix)) {
      const flag = (args[index] as ShellToken).text;
      if (flag === Resources.gitFolderFlag)
        folder = args[index + 1] ?? null;
      index += Resources.gitValueFlags.includes(flag) ? 2 : 1;
    }
    const command = args[index];
    if (!Object.isUndefined(command) && command.isLiteral && Resources.readingGitCommands.includes(command.text)
      && !args.some(t => t.text.startsWith(Resources.gitOutputFlag)))
      return;
    if (Object.isNull(folder))
      this.unnamed();
    else
      this.unnamedAt(folder);
  }

  private copy(sources: readonly ShellToken[], destination: ShellToken, moves: boolean, isRecursive: boolean): void {
    this.write(destination);
    for (const source of sources.flatMap(t => WriteTargetReader.itemsOf(t))) {
      if (source.isLiteral)
        this.write(WriteTargetReader.within(destination, ShellToken.word(source.text.replace(Resources.trailingSeparatorsPattern, String.empty)
          .split(Resources.pathSeparatorPattern).at(-1) as string)));
      else
        this.unnamedAt(destination);
      if (moves)
        this.write(source);
    }
    if (isRecursive)
      this.unnamedAt(destination);
  }

  private remove(targets: readonly ShellToken[], isRecursive: boolean): void {
    for (const target of targets) {
      this.write(target);
      if (isRecursive)
        this.unnamedAt(target);
    }
  }

  private rename(path: ShellToken | undefined, leaf: ShellToken | undefined): boolean {
    if (Object.isUndefined(path) || Object.isUndefined(leaf)) {
      this.unnamed();
      return true;
    }
    const parent = path.text.replace(Resources.trailingSeparatorsPattern, String.empty).split(Resources.pathSeparatorPattern).slice(0, -1);
    this.write(path);
    this.write(parent.length === 0 ? leaf : WriteTargetReader.within(ShellToken.word(parent.join(Resources.folderSeparator), path.isLiteral), leaf));
    return true;
  }

  private changeFolder(target: ShellToken | null): boolean {
    if (Object.isNull(target)) {
      this.folder = Resources.homeFolder;
      return true;
    }
    if (!target.isLiteral || target.text === Resources.previousFolder)
      return false;
    this.folder = this.pathOf(target.text);
    return true;
  }

  private popFolder(): boolean {
    const folder = this.pushed.pop();
    if (Object.isUndefined(folder))
      return false;
    this.folder = folder;
    return true;
  }

  private write(target: ShellToken): void {
    if (target.items.length > 0) {
      target.items.forEach(t => this.write(t));
      return;
    }
    if (Resources.nullDevices.includes(target.text.toLowerCase()))
      return;
    if (target.isLiteral && target.text.length > 0)
      this.files.add(this.pathOf(target.text));
    else
      this.unnamed();
  }

  private unnamed(): void {
    this.unnamedIn.add(this.folder.length === 0 ? Resources.currentFolder : this.folder);
  }

  private unnamedAt(target: ShellToken): void {
    if (target.items.length > 0)
      target.items.forEach(t => this.unnamedAt(t));
    else if (target.isLiteral && target.text.length > 0)
      this.unnamedIn.add(this.pathOf(target.text));
    else
      this.unnamed();
  }

  private pathOf(path: string): string {
    return this.folder.length === 0 || Resources.absoluteTargetPattern.test(path) ? path : `${this.folder}${Resources.folderSeparator}${path}`;
  }

  private static itemsOf(token: ShellToken): readonly ShellToken[] {
    return token.items.length > 0 ? token.items : [token];
  }

  private static listOf(items: readonly ShellToken[]): ShellToken {
    return items.length === 1 ? items[0] as ShellToken : ShellToken.word(items.map(t => t.text).join(Resources.comma), false,
      items.some(t => t.isQuoted), items.some(t => t.runsCommands), items);
  }

  private static within(folder: ShellToken, leaf: ShellToken): ShellToken {
    const parent = folder.text.replace(Resources.trailingSeparatorsPattern, String.empty);
    const path = Resources.absoluteTargetPattern.test(leaf.text) ? leaf.text : `${parent}${Resources.folderSeparator}${leaf.text}`;
    return ShellToken.word(path, folder.isLiteral && leaf.isLiteral);
  }

  private static optionsOf(args: readonly ShellToken[], flags: CommandFlags)
    : { operands: readonly ShellToken[]; options: ReadonlyMap<string, ShellToken | null> } {
    const operands: ShellToken[] = [];
    const options = new Map<string, ShellToken | null>();
    let isEnded = false;
    for (let index = 0; index < args.length; index++) {
      const arg = args[index] as ShellToken;
      const text = arg.text;
      if (isEnded || !arg.isLiteral || !text.startsWith(Resources.flagPrefix) || text === Resources.flagPrefix) {
        operands.push(arg);
        continue;
      }
      if (text === Resources.longFlagPrefix) {
        isEnded = true;
        continue;
      }
      if (text.startsWith(Resources.longFlagPrefix)) {
        const separator = text.indexOf(Resources.flagValueSeparator);
        const flag = separator < 0 ? text : text.slice(0, separator);
        if (separator >= 0)
          options.set(flag, ShellToken.word(text.slice(separator + 1)));
        else if (flags.valueNames.includes(flag))
          options.set(flag, args[++index] ?? null);
        else
          options.set(flag, null);
        continue;
      }
      for (let letter = 1; letter < text.length; letter++) {
        const flag = `${Resources.flagPrefix}${text[letter] as string}`;
        if (!flags.valueLetters.includes(text[letter] as string)) {
          options.set(flag, null);
          continue;
        }
        options.set(flag, letter + 1 < text.length ? ShellToken.word(text.slice(letter + 1)) : args[++index] ?? null);
        break;
      }
    }

    return { operands, options };
  }

  private static parametersOf(args: readonly ShellToken[], parameters: CmdletParameters)
    : { named: ReadonlyMap<string, ShellToken>; switches: readonly string[]; positional: readonly ShellToken[] } | null {
    const named = new Map<string, ShellToken>();
    const switches: string[] = [];
    const positional: ShellToken[] = [];
    for (let index = 0; index < args.length; index++) {
      const arg = args[index] as ShellToken;
      const head = arg.items[0] ?? arg;
      if (!head.isLiteral || !head.text.startsWith(Resources.flagPrefix) || head.text.length === 1) {
        positional.push(arg);
        continue;
      }
      const separator = head.text.indexOf(Resources.parameterValueSeparator);
      if (arg.items.length > 0 && separator < 0)
        return null;
      const name = (separator < 0 ? head.text : head.text.slice(0, separator)).toLowerCase();
      const value = separator < 0 ? args[index + 1] : WriteTargetReader.listOf([ShellToken.word(head.text.slice(separator + 1)), ...arg.items.slice(1)]);
      if (parameters.switches.includes(name) && separator < 0)
        switches.push(name);
      else if (parameters.values.includes(name) && !Object.isUndefined(value) && !named.has(name)) {
        named.set(name, value);
        index += separator < 0 ? 1 : 0;
      }
      else
        return null;
    }

    return { named, switches, positional };
  }
}
