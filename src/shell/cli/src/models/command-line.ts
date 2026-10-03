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
  private static readonly VALUE_OPTIONS: readonly string[] = [Resources.dataDirectoryFlag, Resources.timeoutFlag, Resources.argumentsFileFlag];
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

  public constructor(
    command: CliCommand,
    dataDirectory: string | null = null,
    isJson: boolean = false,
    start: boolean = true,
    takeOver: boolean = false,
    timeoutMilliseconds: number | null = null,
    commandName: string = "",
    argumentsSource: ArgumentsSource = ArgumentsSource.None,
    argumentsText: string = "") {
    this.command = command;
    this.dataDirectory = dataDirectory;
    this.isJson = isJson;
    this.start = start;
    this.takeOver = takeOver;
    this.timeoutMilliseconds = timeoutMilliseconds;
    this.commandName = commandName;
    this.argumentsSource = argumentsSource;
    this.argumentsText = argumentsText;
  }

  public static parse(commandLineArguments: readonly string[]): CommandLine {
    const options = new Map<string, string>();
    const positional: string[] = [];
    const queue = [...commandLineArguments];
    for (let argument = queue.shift(); !Object.isUndefined(argument); argument = queue.shift()) {
      if (argument === Resources.inputArgument || !argument.startsWith(Resources.flagPrefix)) {
        positional.push(argument);
        continue;
      }
      const separator = argument.indexOf(Resources.valueSeparator);
      const name = separator < 0 ? argument : argument.slice(0, separator);
      if (CommandLine.SWITCHES.includes(name) && separator < 0)
        options.set(name, "");
      else if (CommandLine.VALUE_OPTIONS.includes(name)) {
        const value = separator < 0 ? queue.shift() : argument.slice(separator + 1);
        if (Object.isUndefined(value) || value.length === 0)
          throw new UsageException(Resources.formatOptionNeedsValue(name));
        options.set(name, value);
      }
      else
        throw new UsageException(Resources.formatUnknownOption(argument));
    }
    if (options.has(Resources.helpFlag) || positional[0] === Resources.helpCommand)
      return new CommandLine(CliCommand.Help);
    return CommandLine.create(positional, options);
  }

  private static create(positional: readonly string[], options: ReadonlyMap<string, string>): CommandLine {
    const [name, ...rest] = positional;
    if (Object.isUndefined(name))
      throw new UsageException(Resources.commandRequired);
    const command = Object.values(CliCommand).find(t => t === name && t !== CliCommand.Help);
    if (Object.isUndefined(command))
      throw new UsageException(Resources.formatUnknownCommand(name));
    for (const option of [Resources.noStartFlag, Resources.takeOverFlag])
      if (options.has(option) && !CommandLine.ATTACHING.includes(command))
        throw new UsageException(Resources.formatOptionNotForCommand(option, command));
    for (const option of [Resources.timeoutFlag, Resources.argumentsFileFlag])
      if (options.has(option) && command !== CliCommand.Run)
        throw new UsageException(Resources.formatOptionNotForCommand(option, command));

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
      file ?? (source === ArgumentsSource.Inline ? argumentsValue : undefined));
  }

  private static parseTimeout(value: string | undefined): number | null {
    if (Object.isUndefined(value))
      return null;
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > Resources.maximumTimeoutSeconds)
      throw new UsageException(Resources.timeoutInvalid);
    return Math.round(seconds * Resources.millisecondsPerSecond);
  }
}
