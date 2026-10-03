/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";
import { inspect } from "node:util";

import "@noldova/teamrun-foundation-core";
import { ModuleState, ModuleStatus, ModuleStatusList } from "@noldova/teamrun-shell-protocol";

import type { IRuntimePart } from "../../interfaces/runtime-part.js";
import type { IRuntimePartLoader } from "../../interfaces/runtime-part-loader.js";
import { UnknownSchemaException } from "../../exceptions/unknown-schema.exception.js";
import { ModuleActivation } from "../../models/module-activation.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import type { CommandRegistry } from "../registry/command-registry.js";
import { ModuleDatabase } from "../database/module-database.js";
import type { EventRegistry } from "../registry/event-registry.js";
import type { MethodRegistry } from "../registry/method-registry.js";
import { ServiceRegistry } from "../registry/service-registry.js";
import { ModuleContext } from "./module-context.js";

export class ModuleHost {
  private readonly declarations: readonly ModuleDeclaration[];
  private readonly dataDirectory: DataDirectory;
  private readonly methods: MethodRegistry;
  private readonly events: EventRegistry;
  private readonly commands: CommandRegistry;
  private readonly loader: IRuntimePartLoader;
  private readonly diagnostics: Writable;
  private readonly statuses: Map<string, ModuleStatus> = new Map();
  private readonly activations: ModuleActivation[] = [];

  public readonly services: ServiceRegistry = new ServiceRegistry();

  public constructor(
    declarations: readonly ModuleDeclaration[],
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    loader: IRuntimePartLoader,
    diagnostics: Writable) {
    this.declarations = declarations;
    this.dataDirectory = dataDirectory;
    this.methods = methods;
    this.events = events;
    this.commands = commands;
    this.loader = loader;
    this.diagnostics = diagnostics;
  }

  public get report(): ModuleStatusList {
    return new ModuleStatusList([...this.statuses.values()]);
  }

  public async activateAsync(): Promise<void> {
    for (const declaration of this.order())
      this.statuses.set(declaration.id, await this.activateModuleAsync(declaration));
  }

  public async deactivateAsync(): Promise<void> {
    const failures: unknown[] = [];
    for (const activation of this.activations.splice(0).reverse()) {
      try {
        await activation.part.deactivateAsync();
      }
      catch (error) {
        this.writeDiagnostic(activation.context.moduleId, Resources.moduleDeactivationPartFailed, error);
        failures.push(error);
      }
      finally {
        activation.context[Symbol.dispose]();
        activation.database?.close();
      }
    }
    if (failures.length > 0)
      throw new AggregateError(failures, Resources.moduleDeactivationFailed);
  }

  private order(): readonly ModuleDeclaration[] {
    const known = new Set(this.declarations.map(t => t.id));
    const ordered: ModuleDeclaration[] = [];
    let remaining = this.declarations;
    while (remaining.length > 0) {
      const ready = remaining.filter(t => t.dependencies.every(t => !known.has(t) || ordered.some(u => u.id === t)));
      const next = ready.length > 0 ? ready : remaining;
      ordered.push(...next);
      remaining = remaining.filter(t => !next.includes(t));
    }
    return ordered;
  }

  private async activateModuleAsync(declaration: ModuleDeclaration): Promise<ModuleStatus> {
    const blocker = declaration.dependencies.find(t => this.statuses.get(t)?.state !== ModuleState.Active);
    if (!Object.isUndefined(blocker))
      return new ModuleStatus(declaration.id, ModuleState.Blocked, Resources.formatModuleBlocked(blocker));
    if (Object.isNull(declaration.runtimePackage))
      return new ModuleStatus(declaration.id, ModuleState.Active, null);

    let part: IRuntimePart;
    try {
      part = await this.loader.loadAsync(declaration.runtimePackage);
    }
    catch (error) {
      this.writeDiagnostic(declaration.id, Resources.moduleLoadFailed, error);
      return new ModuleStatus(declaration.id, ModuleState.Failed, Resources.moduleLoadFailed);
    }

    let database: ModuleDatabase | undefined;
    if (!Object.isUndefined(part.migrations))
      try {
        database = await ModuleDatabase.openAsync(this.dataDirectory, declaration.id, part.migrations);
      }
      catch (error) {
        const cause = error instanceof UnknownSchemaException ? Resources.moduleDatabaseUnknown : Resources.moduleDatabaseFailed;
        this.writeDiagnostic(declaration.id, cause, error);
        return new ModuleStatus(declaration.id, ModuleState.Failed, cause);
      }

    const context = new ModuleContext(declaration, this.dataDirectory, this.methods, this.events, this.commands, this.services, database);
    try {
      await part.activateAsync(context);
    }
    catch (error) {
      context[Symbol.dispose]();
      database?.close();
      this.writeDiagnostic(declaration.id, Resources.moduleActivationFailed, error);
      return new ModuleStatus(declaration.id, ModuleState.Failed, Resources.moduleActivationFailed);
    }
    this.activations.push(new ModuleActivation(context, part, database));
    return new ModuleStatus(declaration.id, ModuleState.Active, null);
  }

  private writeDiagnostic(moduleId: string, cause: string, error: unknown): void {
    this.diagnostics.write(Resources.formatModuleDiagnostic(moduleId, cause, inspect(error)));
  }
}
