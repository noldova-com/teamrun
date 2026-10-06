/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ArgumentsSource } from "../enums/arguments-source.js";
import { CliCommand } from "../enums/cli-command.js";
import { UsageException } from "../exceptions/usage.exception.js";
import { Resources } from "../resources.js";

export class CommandLine {
  private static readonly VALUE_OPTIONS: readonly string[] = [Resources.dataDirectoryFlag, Resources.deviceDirectoryFlag, Resources.timeoutFlag, Resources.argumentsFileFlag];
  private static readonly SWITCHES: readonly string[] = [Resources.jsonFlag, Resources.noStartFlag, Resources.takeOverFlag, Resources.helpFlag];
  private static readonly ATTACHING: readonly CliCommand[] = [CliCommand.Commands, CliCommand.Run];

  public readonly command: CliCommand;
  public readonly dataDirectory: string | null;
  public readonly isJson: boolean;
  public readonly start: boolean;
  public readonly takeOver: boolean;
  public readonly timeoutMilliseconds: number | null;
  public readonly commandName: string;
  public readonly argumentsSource: ArgumentsSource;
  public readonly argumentsText: string;
  public readonly deviceDirectory: string | null;
  public readonly moduleArguments: readonly string[];
  public readonly isHelp: boolean;

  public constructor(
    command: CliCommand,
    dataDirectory: string | null = null,
    isJson: boolean = false,
    start: boolean = true,
    takeOver: boolean = false,
    timeoutMilliseconds: number | null = null,
    commandName: string = String.empty,
    argumentsSource: ArgumentsSource = ArgumentsSource.None,
    argumentsText: string = String.empty,
    deviceDirectory: string | null = null,
    moduleArguments: readonly string[] = [],
    isHelp: boolean = false) {
    this.command = command;
    this.dataDirectory = dataDirectory;
    this.isJson = isJson;
    this.start = start;
    this.takeOver = takeOver;
    this.timeoutMilliseconds = timeoutMilliseconds;
    this.commandName = commandName;
    this.argumentsSource = argumentsSource;
    this.argumentsText = argumentsText;
    this.deviceDirectory = deviceDirectory;
    this.moduleArguments = moduleArguments;
    this.isHelp = isHelp;
  }

  public static parse(commandLineArguments: readonly string[]): CommandLine {
    const options = new Map<string, string>();
    const positional: string[] = [];
    const queue = [...commandLineArguments];
    const isModule = (): boolean => !Object.isUndefined(positional[0]) && !Resources.ownCommands.has(positional[0]);
    for (let argument = queue.shift(); !Object.isUndefined(argument); argument = queue.shift()) {
      if (argument === Resources.flagPrefix && isModule()) {
        positional.push(argument, ...queue.splice(0));
        break;
      }
      if (argument === Resources.inputArgument || !argument.startsWith(Resources.flagPrefix)) {
        positional.push(argument);
        continue;
      }
      const separator = argument.indexOf(Resources.valueSeparator);
      const name = separator < 0 ? argument : argument.slice(0, separator);
      if (CommandLine.SWITCHES.includes(name) && separator < 0)
        options.set(name, String.empty);
      else if (CommandLine.VALUE_OPTIONS.includes(name)) {
        const value = separator < 0 ? queue.shift() : argument.slice(separator + 1);
        if (Object.isUndefined(value) || value.length === 0)
          throw new UsageException(Resources.formatOptionNeedsValue(name));
        options.set(name, value);
      }
      else if (isModule())
        positional.push(argument);
      else
        throw new UsageException(Resources.formatUnknownOption(argument));
    }
    if (Resources.ownCommands.get(positional[0] ?? String.empty) === CliCommand.Help)
      return new CommandLine(CliCommand.Help, null, options.has(Resources.jsonFlag), true, false, null, String.empty, ArgumentsSource.None, String.empty, null, positional.slice(1));
    if (options.has(Resources.helpFlag) && !isModule())
      return new CommandLine(CliCommand.Help, null, options.has(Resources.jsonFlag));
    return CommandLine.create(positional, options);
  }

  private static create(positional: readonly string[], options: ReadonlyMap<string, string>): CommandLine {
    const [name, ...rest] = positional;
    if (Object.isUndefined(name))
      throw new UsageException(Resources.commandRequired);
    const command = Resources.ownCommands.get(name);
    if (Object.isUndefined(command))
      return CommandLine.createModule(positional, options);
    for (const option of [Resources.noStartFlag, Resources.takeOverFlag])
      if (options.has(option) && !CommandLine.ATTACHING.includes(command))
        throw new UsageException(Resources.formatOptionNotForCommand(option, name));
    for (const option of [Resources.timeoutFlag, Resources.argumentsFileFlag])
      if (options.has(option) && command !== CliCommand.Run)
        throw new UsageException(Resources.formatOptionNotForCommand(option, name));

    const [commandName, argumentsValue, unexpected] = command === CliCommand.Run ? rest : [undefined, undefined, rest[0]];
    if (!Object.isUndefined(unexpected))
      throw new UsageException(Resources.formatUnexpectedArgument(unexpected));
    if (command === CliCommand.Run && Object.isUndefined(commandName))
      throw new UsageException(Resources.commandNameRequired);
    if (!Object.isUndefined(argumentsValue) && options.has(Resources.argumentsFileFlag))
      throw new UsageException(Resources.argumentsTwice);

    const file = options.get(Resources.argumentsFileFlag);
    const source = !Object.isUndefined(file) ? ArgumentsSource.File
      : argumentsValue === Resources.inputArgument ? ArgumentsSource.Input
        : Object.isUndefined(argumentsValue) ? ArgumentsSource.None : ArgumentsSource.Inline;
    return new CommandLine(
      command,
      options.get(Resources.dataDirectoryFlag) ?? null,
      options.has(Resources.jsonFlag),
      !options.has(Resources.noStartFlag),
      options.has(Resources.takeOverFlag),
      CommandLine.parseTimeout(options.get(Resources.timeoutFlag)),
      commandName,
      source,
      file ?? (source === ArgumentsSource.Inline ? argumentsValue : undefined),
      options.get(Resources.deviceDirectoryFlag) ?? null);
  }

  private static createModule(positional: readonly string[], options: ReadonlyMap<string, string>): CommandLine {
    if (options.has(Resources.argumentsFileFlag))
      throw new UsageException(Resources.formatOptionNotForModuleCommands(Resources.argumentsFileFlag));
    const [moduleId, ...rest] = positional;
    return new CommandLine(
      CliCommand.Module,
      options.get(Resources.dataDirectoryFlag) ?? null,
      options.has(Resources.jsonFlag),
      !options.has(Resources.noStartFlag),
      options.has(Resources.takeOverFlag),
      CommandLine.parseTimeout(options.get(Resources.timeoutFlag)),
      String(moduleId),
      ArgumentsSource.None,
      String.empty,
      options.get(Resources.deviceDirectoryFlag) ?? null,
      rest,
      options.has(Resources.helpFlag));
  }

  private static parseTimeout(value: string | undefined): number | null {
    if (Object.isUndefined(value))
      return null;
    const seconds = Number(value);
    if (!Resources.wholeSecondsPattern.test(value) || seconds < Resources.minimumTimeoutSeconds || seconds > Resources.maximumTimeoutSeconds)
      throw new UsageException(Resources.timeoutInvalid);
    return seconds * Resources.millisecondsPerSecond;
  }
}
