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
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  CommandList,
  CommandRun,
  Failure,
  FailureCode,
  type ModuleStatus,
  ModuleStatusList,
  QualifiedName,
  QuitReport,
  ShellEvents,
  ShellMethods,
  StopPolicy,
  UpdateSaved,
  WorkReport
} from "@noldova/teamrun-shell-protocol";
import {
  AppImageSource,
  AttachOptions,
  ConnectionException,
  type DataDirectory,
  DataDirectoryLocator,
  DeviceFolder,
  Installation,
  LaunchException,
  LaunchSettings,
  MethodFailureException,
  ProcessPresence,
  type RuntimeClient,
  RuntimeLauncher,
  SystemCommand,
  UpdateBarrierStatus,
  UpdateInProgressException
} from "@noldova/teamrun-shell-runtime";

import { ArgumentsSource } from "../enums/arguments-source.js";
import { CliCommand } from "../enums/cli-command.js";
import { ExitCode } from "../enums/exit-code.js";
import { CliCommandException } from "../exceptions/cli-command.exception.js";
import { ModuleNotActiveException } from "../exceptions/module-not-active.exception.js";
import { UsageException } from "../exceptions/usage.exception.js";
import type { CliCommandResult } from "../models/cli-command-result.js";
import type { CliContext } from "../models/cli-context.js";
import { CliFailure } from "../models/cli-failure.js";
import type { CliModule } from "../models/cli-module.js";
import { CommandLine } from "../models/command-line.js";
import { ModuleCall } from "../models/module-call.js";
import { StatusReport } from "../models/status-report.js";
import { Resources } from "../resources.js";
import { CliHelp } from "./cli-help.js";
import { CliModuleReader } from "./cli-module.reader.js";
import { CliOutput } from "./cli-output.js";
import { CliPartHost } from "./cli-part-host.js";

export class Cli {
  private static readonly IGNORE: () => void = () => undefined;

  private readonly context: CliContext;
  private isUpdating: boolean = false;

  public constructor(context: CliContext) {
    this.context = context;
  }

  public async runAsync(commandLineArguments: readonly string[]): Promise<number> {
    let commandLine: CommandLine;
    try {
      commandLine = CommandLine.parse(commandLineArguments);
    }
    catch (error) {
      return this.fail(new CliOutput(this.context.output, this.context.error, commandLineArguments.includes(Resources.jsonFlag)), error, Resources.usage);
    }

    const output = new CliOutput(this.context.output, this.context.error, commandLine.isJson);
    try {
      switch (commandLine.command) {
        case CliCommand.Help:
          return await this.helpAsync(commandLine, output);
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
        case CliCommand.Quit:
          output.writeQuit(await this.quitAsync(commandLine));
          return ExitCode.Success;
        case CliCommand.Module:
          return await this.runModuleAsync(commandLine, output);
      }
    }
    catch (error) {
      return this.failCommand(output, error);
    }
  }

  private failCommand(output: CliOutput, error: unknown): number {
    return this.fail(output, this.isUpdating ? new UpdateInProgressException(UpdateBarrierStatus.Held) : error, null);
  }

  private fail(output: CliOutput, error: unknown, usage: string | null): number {
    const failure = error instanceof MethodFailureException ? CliFailure.fromFailure(error.failure) : CliFailure.fromError(error);
    output.writeFailure(failure, usage);
    return failure.exitCode;
  }

  private async helpAsync(commandLine: CommandLine, output: CliOutput): Promise<number> {
    const modules = await CliModuleReader.readAsync(this.context.runtimeEntryPath);
    const [moduleId, word, unexpected] = commandLine.moduleArguments;
    const module = modules.find(t => t.id === moduleId);
    if (Object.isUndefined(module)) {
      if (!Object.isUndefined(moduleId) && !Resources.ownCommands.has(moduleId))
        return this.fail(output, new UsageException(Resources.formatUnknownCommand(moduleId)), Resources.usage);
      if (!Object.isUndefined(word))
        return this.fail(output, new UsageException(Resources.formatUnexpectedArgument(word)), Resources.usage);
      return Cli.help(output, CliHelp.formatAll(modules));
    }
    if (!Object.isUndefined(unexpected))
      return this.fail(output, new UsageException(Resources.formatUnexpectedArgument(unexpected)), CliHelp.formatModule(module));
    if (Object.isUndefined(word))
      return Cli.help(output, CliHelp.formatModule(module));
    const command = module.commands.find(t => t.word === word);
    if (Object.isUndefined(command))
      return this.fail(output, new UsageException(Resources.formatUnknownModuleCommand(word, module.id)), CliHelp.formatModule(module));
    return Cli.help(output, CliHelp.formatCommand(module, command));
  }

  private async runModuleAsync(commandLine: CommandLine, output: CliOutput): Promise<number> {
    const modules = await CliModuleReader.readAsync(this.context.runtimeEntryPath);
    const module = modules.find(t => t.id === commandLine.commandName);
    if (Object.isUndefined(module))
      return this.fail(output, new UsageException(Resources.formatUnknownCommand(commandLine.commandName)), Resources.usage);
    const [word, ...rest] = commandLine.moduleArguments;
    const command = module.commands.find(t => t.word === word);
    if (Object.isUndefined(command)) {
      if (commandLine.isHelp)
        return Cli.help(output, CliHelp.formatModule(module));
      const problem = Object.isUndefined(word) ? Resources.formatModuleCommandRequired(module.id) : Resources.formatUnknownModuleCommand(word, module.id);
      return this.fail(output, new UsageException(problem), CliHelp.formatModule(module));
    }
    const usage = CliHelp.formatCommand(module, command);
    if (commandLine.isHelp)
      return Cli.help(output, usage);
    let call: ModuleCall;
    try {
      call = ModuleCall.parse(command, rest);
    }
    catch (error) {
      return this.fail(output, error, usage);
    }
    return await this.runModuleCommandAsync(commandLine, output, usage, modules, module, call);
  }

  private async runModuleCommandAsync(
    commandLine: CommandLine, output: CliOutput, usage: string, modules: readonly CliModule[], module: CliModule, call: ModuleCall): Promise<number> {
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver));
    try {
      const host = new CliPartHost(modules, (method, payload, signal) => Cli.callAsync(client, method, payload, undefined, signal),
        reason => Cli.writeStopFailure(output, [reason]));
      const outcome = await this.untilStoppedAsync(signal => Cli.runPartsAsync(client, host, module, call, signal), commandLine.timeoutMilliseconds)
        .then(result => ({ result }), (error: unknown) => ({ error }));
      const failures = await host.stopAsync();
      let code: number;
      if ("error" in outcome)
        code = outcome.error instanceof UsageException ? this.fail(output, outcome.error, usage) : this.failCommand(output, outcome.error);
      else {
        output.writeCommandResult(outcome.result);
        code = ExitCode.Success;
      }
      if (failures.length === 0)
        return code;
      Cli.writeStopFailure(output, failures);
      return code === ExitCode.Success ? ExitCode.PartNotStopped : code;
    }
    finally {
      client.close();
    }
  }

  private static writeStopFailure(output: CliOutput, reasons: readonly string[]): void {
    output.writeFailure(new CliFailure(ExitCode.PartNotStopped, Resources.partNotStoppedCode, Resources.formatCliPartStopFailed(reasons.join(Resources.reasonSeparator))), null);
  }

  private async untilStoppedAsync<T>(work: (signal: AbortSignal) => Promise<T>, timeout: number | null): Promise<T> {
    const controller = new AbortController();
    const stopped = Promise.withResolvers<never>();
    const stop = (failure: Failure): void => {
      controller.abort();
      stopped.reject(new MethodFailureException(failure));
    };
    const interrupt = (): void => stop(new Failure(FailureCode.Cancelled, Resources.cancelled));
    this.listen(interrupt);
    const timer = Object.isNull(timeout) ? undefined : setTimeout(() => stop(new Failure(FailureCode.DeadlineExceeded, Resources.timedOut)), timeout);
    try {
      return await Promise.race([work(controller.signal), stopped.promise]);
    }
    finally {
      clearTimeout(timer);
      this.unlisten(interrupt);
    }
  }

  private static async runPartsAsync(client: RuntimeClient, host: CliPartHost, module: CliModule, call: ModuleCall, signal: AbortSignal): Promise<CliCommandResult> {
    const status = await Cli.findModuleAsync(client, module.id, signal);
    if (Object.isUndefined(status))
      throw new ModuleNotActiveException(module.id, Resources.moduleNotInRuntime);
    Cli.requireActive(status);
    const handler = await host.startAsync(module, call.command, signal);
    try {
      return await handler.handleAsync(call.values, signal);
    }
    catch (error) {
      throw error instanceof UsageException || error instanceof CliCommandException || error instanceof MethodFailureException || error instanceof ConnectionException
        ? error
        : new CliCommandException(Resources.failedCode, Resources.formatCommandFailed(Resources.formatReason(error)));
    }
  }

  private async readStatusAsync(commandLine: CommandLine): Promise<StatusReport> {
    const directory = this.locate(commandLine);
    const client = await this.attachAsync(commandLine, directory, new AttachOptions(false, false));
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
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver));
    try {
      return CommandList.fromJson(await Cli.callAsync(client, ShellMethods.commands, null));
    }
    finally {
      client.close();
    }
  }

  private async runCommandAsync(commandLine: CommandLine): Promise<JsonValue> {
    const run = new CommandRun(Cli.parseName(commandLine.commandName), await this.readArgumentsAsync(commandLine));
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(commandLine.start, commandLine.takeOver));
    const controller = new AbortController();
    const interrupt = (): void => controller.abort();
    this.listen(interrupt);
    try {
      return await Cli.callAsync(client, ShellMethods.runCommand, run.toJson(), commandLine.timeoutMilliseconds ?? undefined, controller.signal);
    }
    catch (error) {
      if (error instanceof MethodFailureException && error.failure.code === FailureCode.NotFound) {
        const status = await Cli.findModuleAsync(client, run.name.owner);
        if (!Object.isUndefined(status))
          Cli.requireActive(status);
      }
      throw error;
    }
    finally {
      this.unlisten(interrupt);
      client.close();
    }
  }

  private async quitAsync(commandLine: CommandLine): Promise<QuitReport> {
    const client = await this.attachAsync(commandLine, this.locate(commandLine), new AttachOptions(false, false));
    const controller = new AbortController();
    const interrupt = (): void => controller.abort();
    this.listen(interrupt);
    try {
      return QuitReport.fromJson(await Cli.callAsync(client, ShellMethods.quit, null, commandLine.timeoutMilliseconds ?? undefined, controller.signal));
    }
    finally {
      this.unlisten(interrupt);
      client.close();
    }
  }

  private listen(interrupt: () => void): void {
    for (const signal of Resources.interruptSignals)
      this.context.signals.on(signal, interrupt);
  }

  private unlisten(interrupt: () => void): void {
    for (const signal of Resources.interruptSignals)
      this.context.signals.off(signal, interrupt);
  }

  private async openAsync(commandLine: CommandLine): Promise<string> {
    const directory = this.locate(commandLine);
    const checkout = this.context.environment[Resources.checkoutVariable] ?? String.empty;
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
    const checkout = this.context.environment[Resources.checkoutVariable] ?? String.empty;
    const explicit = Object.isNull(commandLine.dataDirectory) ? undefined : path.resolve(commandLine.dataDirectory);
    return DataDirectoryLocator.locate(String.isNullOrWhitespace(checkout), this.context.environment, this.context.homeFolder, checkout, explicit);
  }

  private async attachAsync(commandLine: CommandLine, directory: DataDirectory, options: AttachOptions): Promise<RuntimeClient> {
    const launcher = this.createLauncher(commandLine, directory);
    const deadline = Date.now() + this.context.updateWaitMilliseconds;
    for (;;) {
      try {
        return await this.connectAsync(launcher, options);
      }
      catch (error) {
        if (!Cli.isUpdateUnderWay(error) || Date.now() >= deadline)
          throw error;
      }
      await delay(Resources.updatePollInterval);
    }
  }

  private createLauncher(commandLine: CommandLine, directory: DataDirectory): RuntimeLauncher {
    const context = this.context;
    const environment = { ...context.environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue };
    const settings = new LaunchSettings(directory, context.executablePath, context.runtimeEntryPath, environment, context.platform);
    const deviceFolder = Object.isNull(commandLine.deviceDirectory)
      ? DeviceFolder.locate(context.platform, context.environment, context.homeFolder)
      : path.resolve(commandLine.deviceDirectory);
    const presence = ProcessPresence.create(context.platform, new SystemCommand());
    const installation = new Installation(Installation.locate(deviceFolder, AppImageSource.locateProgram(context.environment, context.executablePath), context.platform), t => presence.isRunningAsync(t));
    return new RuntimeLauncher(settings, context.identity, installation, context.runtimeStarter);
  }

  private async connectAsync(launcher: RuntimeLauncher, options: AttachOptions): Promise<RuntimeClient> {
    const attached = Promise.withResolvers<RuntimeClient>();
    const client = await launcher.attachAsync(Resources.clientName, {
      onEvent: event => {
        if (event.name.equals(ShellEvents.updating))
          void attached.promise.then(t => this.answerUpdate(t));
      },
      onDisconnected: Cli.IGNORE
    }, StopPolicy.IfIdle, options);
    attached.resolve(client);
    return client;
  }

  private answerUpdate(client: RuntimeClient): void {
    this.isUpdating = true;
    const close = (): void => client.close();
    void client.callAsync(ShellMethods.updateSaved, new UpdateSaved(this.context.processId, []).toJson()).then(close, close);
  }

  private static help(output: CliOutput, help: string): number {
    output.writeHelp(help);
    return ExitCode.Success;
  }

  private static async findModuleAsync(client: RuntimeClient, moduleId: string, signal?: AbortSignal): Promise<ModuleStatus | undefined> {
    return ModuleStatusList.fromJson(await Cli.callAsync(client, ShellMethods.modules, null, undefined, signal)).modules.find(t => t.id === moduleId);
  }

  private static requireActive(status: ModuleStatus): void {
    if (!Object.isNull(status.cause))
      throw new ModuleNotActiveException(status.id, status.cause, status.blockedBy);
  }

  private static isUpdateUnderWay(error: unknown): boolean {
    return (error instanceof UpdateInProgressException && error.status === UpdateBarrierStatus.Held)
      || (error instanceof ConnectionException && error.failure?.code === FailureCode.Updating);
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
