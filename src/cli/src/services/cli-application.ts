/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";

import "@noldova/teamrun-foundation-core";

import { CommandFailedException } from "../exceptions/command-failed.exception.js";
import { UsageException } from "../exceptions/usage.exception.js";
import type { IConnectionFactoryBuilder } from "../interfaces/i-connection-factory-builder.js";
import type { IConsole } from "../interfaces/i-console.js";
import { CliSettings } from "../models/cli-settings.js";
import { CommandContext } from "../models/command-context.js";
import { CommandLine } from "../models/command-line.js";
import { Resources } from "../resources.js";
import type { CommandRegistry } from "./command-registry.js";

export class CliApplication {
  private readonly registry: CommandRegistry;
  private readonly connections: IConnectionFactoryBuilder;

  public constructor(registry: CommandRegistry, connections: IConnectionFactoryBuilder) {
    this.registry = registry;
    this.connections = connections;
  }

  public async run(args: readonly string[], console: IConsole, signals: EventEmitter): Promise<number> {
    const commandLine = CommandLine.parse(args);
    const settings = CliSettings.fromCommandLine(commandLine);
    const name = commandLine.command ?? Resources.helpCommand;
    const command = this.registry.find(name);
    if (Object.isNull(command)) {
      console.writeError(Resources.formatUnknownCommand(name));
      return Resources.exitUsage;
    }

    try {
      return await command.run(new CommandContext(commandLine, settings, console, this.connections.build(settings), signals));
    }
    catch (error) {
      return CliApplication.report(error, console);
    }
  }

  private static report(error: unknown, console: IConsole): number {
    if (error instanceof UsageException) {
      console.writeError(error.message);
      return Resources.exitUsage;
    }
    if (error instanceof CommandFailedException) {
      console.writeError(error.message);
      return Resources.exitFailure;
    }

    console.writeError(Resources.formatConnectionFailure(error instanceof Error ? error.message : String(error)));
    return Resources.exitFailure;
  }
}
