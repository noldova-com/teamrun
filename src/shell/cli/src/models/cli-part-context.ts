/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { ICliCommandHandler } from "../interfaces/i-cli-command-handler.js";
import type { ICliPartContext } from "../interfaces/i-cli-part-context.js";
import { Resources } from "../resources.js";
import type { CliModule } from "./cli-module.js";

export class CliPartContext implements ICliPartContext {
  private readonly module: CliModule;
  private readonly handlers: Map<string, ICliCommandHandler>;
  private readonly request: (method: string, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>;

  public constructor(
    module: CliModule,
    handlers: Map<string, ICliCommandHandler>,
    request: (method: string, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>) {
    this.module = module;
    this.handlers = handlers;
    this.request = request;
  }

  public get moduleId(): string {
    return this.module.id;
  }

  public registerCommand(name: string, handler: ICliCommandHandler): void {
    if (!this.module.commands.some(t => t.name === name))
      throw new ArgumentException(Resources.formatCommandNotDeclared(name, this.module.id), Resources.nameParameterName);
    if (this.handlers.has(name))
      throw new ArgumentException(Resources.formatCommandRegisteredTwice(name), Resources.nameParameterName);
    this.handlers.set(name, handler);
  }

  public requestAsync(method: string, payload: JsonValue, signal: AbortSignal): Promise<JsonValue> {
    return this.request(method, payload, signal);
  }
}
