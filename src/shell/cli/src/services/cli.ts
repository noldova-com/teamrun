/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { text } from "node:stream/consumers";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { CommandList, CommandRun, ModuleStatusList, QualifiedName, ShellMethods, StopPolicy, WorkReport } from "@noldova/teamrun-shell-protocol";
import {
  AttachOptions,
  type DataDirectory,
  DataDirectoryLocator,
  type IRuntimeClientListener,
  LaunchException,
  LaunchSettings,
  MethodFailureException,
  type RuntimeClient,
  RuntimeLauncher
} from "@noldova/teamrun-shell-runtime";

import { ArgumentsSource } from "../enums/arguments-source.js";
import { CliCommand } from "../enums/cli-command.js";
import { ExitCode } from "../enums/exit-code.js";
import { UsageException } from "../exceptions/usage.exception.js";
import type { CliContext } from "../models/cli-context.js";
import { CliFailure } from "../models/cli-failure.js";
import { CommandLine } from "../models/command-line.js";
import { StatusReport } from "../models/status-report.js";
import { Resources } from "../resources.js";
import { CliOutput } from "./cli-output.js";

export class Cli {
  private static readonly IGNORE: () => void = () => undefined;
  private static readonly LISTENER: IRuntimeClientListener = { onEvent: Cli.IGNORE, onDisconnected: Cli.IGNORE };

  private readonly context: CliContext;

  public constructor(context: CliContext) {
    this.context = context;
  }

  public async runAsync(commandLineArguments: readonly string[]): Promise<number> {
    let commandLine: CommandLine;
    try {
      commandLine = CommandLine.parse(commandLineArguments);
    }
    catch (error) {
      return this.fail(new CliOutput(this.context.output, this.context.error, commandLineArguments.includes(Resources.jsonFlag)), error, true);
    }

    const output = new CliOutput(this.context.output, this.context.error, commandLine.isJson);
    try {
      switch (commandLine.command) {
        case CliCommand.Help:
          output.writeUsage();
          return ExitCode.Success;
        case CliCommand.Status:
          output.writeStatus(await this.readStatusAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Commands:
          output.writeCommands(await this.readCommandsAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Run:
          output.writeResult(await this.runCommandAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Open:
          output.writeOpened(await this.openAsync(commandLine));
          return ExitCode.Success;
      }
    }
    catch (error) {
      return this.fail(output, error, false);
    }
  }

  private fail(output: CliOutput, error: unknown, withUsage: boolean): number {
    const failure = error instanceof MethodFailureException ? CliFailure.fromFailure(error.failure) : CliFailure.fromError(error);
    output.writeFailure(failure, withUsage);
    return failure.exitCode;
  }

  private async readStatusAsync(commandLine: CommandLine): Promise<StatusReport> {
    const directory = this.locate(commandLine);
    const client = await this.attachAsync(directory, new AttachOptions(false, false));
    try {
      const modules = ModuleStatusList.fromJson(await Cli.callAsync(client, ShellMethods.modules, null));
      const work = WorkReport.fromJson(await Cli.callAsync(client, ShellMethods.work, null));
      return new StatusReport(this.context.identity, directory.root, modules, work);
    }
    finally {
      client.close();
    }
  }

  private async readCommandsAsync(commandLine: CommandLine): Promise<CommandList> {
    const client = await this.attachAsync(this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver));
    try {
      return CommandList.fromJson(await Cli.callAsync(client, ShellMethods.commands, null));
    }
    finally {
      client.close();
    }
  }

  private async runCommandAsync(commandLine: CommandLine): Promise<JsonValue> {
    const run = new CommandRun(Cli.parseName(commandLine.commandName), await this.readArgumentsAsync(commandLine));
    const client = await this.attachAsync(this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver));
    const controller = new AbortController();
    const interrupt = (): void => controller.abort();
    this.context.signals.on(Resources.interruptSignal, interrupt);
    try {
      return await Cli.callAsync(client, ShellMethods.runCommand, run.toJson(), commandLine.timeoutMilliseconds ?? undefined, controller.signal);
    }
    finally {
      this.context.signals.off(Resources.interruptSignal, interrupt);
      client.close();
    }
  }

  private async openAsync(commandLine: CommandLine): Promise<string> {
    const directory = this.locate(commandLine);
    const checkout = this.context.environment[Resources.checkoutVariable] ?? "";
    const desktopArguments = [
      ...String.isNullOrWhitespace(checkout) ? [] : [path.join(checkout, ...Resources.desktopMainSegments)],
      `${Resources.dataDirectoryFlag}${Resources.valueSeparator}${directory.root}`
    ];
    const environment = { ...this.context.environment };
    delete environment[Resources.runAsNodeVariable];
    try {
      await this.context.desktopOpener.openAsync(this.context.executablePath, desktopArguments, environment);
    }
    catch (error) {
      throw new LaunchException(Resources.desktopNotStarted, new ExceptionOptions(error));
    }
    return directory.root;
  }

  private locate(commandLine: CommandLine): DataDirectory {
    const checkout = this.context.environment[Resources.checkoutVariable] ?? "";
    const explicit = Object.isNull(commandLine.dataDirectory) ? undefined : path.resolve(commandLine.dataDirectory);
    return DataDirectoryLocator.locate(String.isNullOrWhitespace(checkout), this.context.environment, this.context.homeFolder, checkout, explicit);
  }

  private attachAsync(directory: DataDirectory, options: AttachOptions): Promise<RuntimeClient> {
    const environment = { ...this.context.environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue };
    const settings = new LaunchSettings(directory, this.context.executablePath, this.context.runtimeEntryPath, environment, this.context.platform);
    return new RuntimeLauncher(settings, this.context.identity, this.context.runtimeStarter).attachAsync(Resources.clientName, Cli.LISTENER, StopPolicy.IfIdle, options);
  }

  private async readArgumentsAsync(commandLine: CommandLine): Promise<JsonValue> {
    let source: string;
    switch (commandLine.argumentsSource) {
      case ArgumentsSource.None:
        return null;
      case ArgumentsSource.Inline:
        source = commandLine.argumentsText;
        break;
      case ArgumentsSource.File:
        source = await Cli.readArgumentsFileAsync(commandLine.argumentsText);
        break;
      case ArgumentsSource.Input:
        source = await text(this.context.input);
        break;
    }
    try {
      return JSON.parse(source) as JsonValue;
    }
    catch (error) {
      throw new UsageException(Resources.formatArgumentsInvalid((error as Error).message));
    }
  }

  private static async readArgumentsFileAsync(file: string): Promise<string> {
    try {
      return await readFile(file, Resources.utf8Encoding);
    }
    catch (error) {
      throw new UsageException(Resources.formatArgumentsFileUnreadable(file, (error as Error).message));
    }
  }

  private static parseName(name: string): QualifiedName {
    try {
      return QualifiedName.parse(name);
    }
    catch (error) {
      throw new UsageException((error as Error).message);
    }
  }

  private static async callAsync(client: RuntimeClient, method: QualifiedName, payload: JsonValue, timeout?: number, signal?: AbortSignal): Promise<JsonValue> {
    const response = await client.callAsync(method, payload, timeout, signal);
    const failure = response.failure;
    if (!Object.isUndefined(failure))
      throw new MethodFailureException(failure);
    return response.payload ?? null;
  }
}
