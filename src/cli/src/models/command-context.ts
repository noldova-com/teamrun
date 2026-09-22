/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";

import type { IConnectionFactory } from "../interfaces/i-connection-factory.js";
import type { IConsole } from "../interfaces/i-console.js";
import type { CliSettings } from "./cli-settings.js";
import type { CommandLine } from "./command-line.js";

export class CommandContext {
  public readonly commandLine: CommandLine;
  public readonly settings: CliSettings;
  public readonly console: IConsole;
  public readonly connections: IConnectionFactory;
  public readonly signals: EventEmitter;

  public constructor(commandLine: CommandLine, settings: CliSettings, console: IConsole, connections: IConnectionFactory, signals: EventEmitter) {
    this.commandLine = commandLine;
    this.settings = settings;
    this.console = console;
    this.connections = connections;
    this.signals = signals;
  }
}
