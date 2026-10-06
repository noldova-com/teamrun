/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { ModuleNotActiveException } from "../exceptions/module-not-active.exception.js";
import type { ICliCommandHandler } from "../interfaces/i-cli-command-handler.js";
import type { ICliPart } from "../interfaces/i-cli-part.js";
import type { CliCommandDefinition } from "../models/cli-command-definition.js";
import type { CliModule } from "../models/cli-module.js";
import { CliPartContext } from "../models/cli-part-context.js";
import { Resources } from "../resources.js";

export class CliPartHost {
  private readonly modules: readonly CliModule[];
  private readonly request: (method: string, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>;
  private readonly started: ICliPart[] = [];
  private readonly handlers: Map<string, ICliCommandHandler> = new Map();

  public constructor(modules: readonly CliModule[], request: (method: string, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>) {
    this.modules = modules;
    this.request = request;
  }

  public async startAsync(target: CliModule, command: CliCommandDefinition): Promise<ICliCommandHandler> {
    const needed = new Set([target.id]);
    for (const module of this.modules.toReversed())
      if (needed.has(module.id))
        module.dependencies.forEach(t => needed.add(t));
    for (const module of this.modules)
      if (needed.has(module.id) && !Object.isNull(module.cliPackage))
        await this.startPartAsync(module, module.cliPackage);
    const handler = this.handlers.get(command.name);
    if (Object.isUndefined(handler))
      throw new ModuleNotActiveException(target.id, Resources.formatCommandNotRegistered(command.name));
    return handler;
  }

  public async stopAsync(): Promise<void> {
    for (const part of this.started.toReversed())
      await part.deactivateAsync();
  }

  private async startPartAsync(module: CliModule, packageName: string): Promise<void> {
    let part: unknown;
    try {
      const type: unknown = Reflect.get(await import(packageName) as object, Resources.cliPartExport);
      part = Object.isFunction(type) ? Reflect.construct(type, []) : undefined;
    }
    catch (error) {
      throw new ModuleNotActiveException(module.id, Resources.formatCliPartFailed((error as Error).message));
    }
    if (!CliPartHost.isCliPart(part))
      throw new ModuleNotActiveException(module.id, Resources.cliPartMissing);
    try {
      await part.activateAsync(new CliPartContext(module, this.handlers, this.request));
    }
    catch (error) {
      throw new ModuleNotActiveException(module.id, Resources.formatCliPartFailed((error as Error).message));
    }
    this.started.push(part);
  }

  private static isCliPart(value: unknown): value is ICliPart {
    return Object.isObject(value)
      && Object.isFunction(Reflect.get(value, Resources.activateMember))
      && Object.isFunction(Reflect.get(value, Resources.deactivateMember));
  }
}
