/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { QualifiedName } from "@noldova/teamrun-shell-protocol";

import { ModuleNotActiveException } from "../exceptions/module-not-active.exception.js";
import type { ICliCommandHandler } from "../interfaces/i-cli-command-handler.js";
import type { ICliPart } from "../interfaces/i-cli-part.js";
import type { CliCommandDefinition } from "../models/cli-command-definition.js";
import type { CliModule } from "../models/cli-module.js";
import { CliPartContext } from "../models/cli-part-context.js";
import { Resources } from "../resources.js";

export class CliPartHost {
  private readonly modules: readonly CliModule[];
  private readonly request: (method: QualifiedName, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>;
  private readonly started: ICliPart[] = [];
  private readonly handlers: Map<string, ICliCommandHandler> = new Map();

  public constructor(modules: readonly CliModule[], request: (method: QualifiedName, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>) {
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

  public async stopAsync(): Promise<readonly string[]> {
    const failures: string[] = [];
    for (const part of this.started.splice(0).toReversed()) {
      try {
        await part.deactivateAsync();
      }
      catch (error) {
        failures.push(String(error));
      }
    }
    return failures;
  }

  private async startPartAsync(module: CliModule, packageName: string): Promise<void> {
    let part: unknown;
    try {
      const exports: object = await import(packageName);
      const type = Resources.cliPartExport in exports ? exports[Resources.cliPartExport] : undefined;
      part = Object.isFunction(type) ? Reflect.construct(type, []) : undefined;
    }
    catch (error) {
      throw new ModuleNotActiveException(module.id, Resources.formatCliPartFailed(String(error)));
    }
    if (!CliPartHost.isCliPart(part))
      throw new ModuleNotActiveException(module.id, Resources.cliPartMissing);
    this.started.push(part);
    try {
      await part.activateAsync(new CliPartContext(module, this.handlers, this.request));
    }
    catch (error) {
      throw new ModuleNotActiveException(module.id, Resources.formatCliPartFailed(String(error)));
    }
  }

  private static isCliPart(value: unknown): value is ICliPart {
    return Object.isObject(value)
      && Resources.activateMember in value
      && Object.isFunction(value[Resources.activateMember])
      && Resources.deactivateMember in value
      && Object.isFunction(value[Resources.deactivateMember]);
  }
}
