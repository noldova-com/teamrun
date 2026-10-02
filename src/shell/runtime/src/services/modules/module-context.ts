/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import { ModuleDatabaseException } from "../../exceptions/module-database.exception.js";
import { RegistrationException } from "../../exceptions/registration.exception.js";
import { ServiceAccessException } from "../../exceptions/service-access.exception.js";
import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { IModuleDatabase } from "../../interfaces/module-database.js";
import type { IRuntimePartContext } from "../../interfaces/runtime-part-context.js";
import type { EventChannel } from "../../models/event-channel.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import type { RuntimeCommand } from "../../models/runtime-command.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import type { CommandRegistry } from "../registry/command-registry.js";
import type { EventRegistry } from "../registry/event-registry.js";
import type { MethodRegistry } from "../registry/method-registry.js";
import type { ServiceRegistry } from "../registry/service-registry.js";

export class ModuleContext implements IRuntimePartContext, Disposable {
  private readonly declaration: ModuleDeclaration;
  private readonly methods: MethodRegistry;
  private readonly events: EventRegistry;
  private readonly commands: CommandRegistry;
  private readonly services: ServiceRegistry;
  private readonly registrations: Disposable[] = [];
  private readonly moduleDatabase?: IModuleDatabase;

  public readonly moduleFolder: string;

  public constructor(
    declaration: ModuleDeclaration,
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    services: ServiceRegistry,
    database?: IModuleDatabase) {
    this.declaration = declaration;
    if (!Object.isUndefined(database))
      this.moduleDatabase = database;
    this.methods = methods;
    this.events = events;
    this.commands = commands;
    this.services = services;
    this.moduleFolder = dataDirectory.locateModuleFolder(declaration.id);
  }

  public get moduleId(): string {
    return this.declaration.id;
  }

  public get database(): IModuleDatabase {
    if (Object.isUndefined(this.moduleDatabase))
      throw new ModuleDatabaseException(Resources.formatNoModuleDatabase(this.declaration.id));
    return this.moduleDatabase;
  }

  public registerMethod(name: string, handler: IMethodHandler): void {
    this.registrations.push(this.methods.register(this.requireContributed(Resources.methodsKind, name), handler));
  }

  public declareEvent(name: string): EventChannel {
    const channel = this.events.declare(this.requireContributed(Resources.eventsKind, name));
    this.registrations.push(channel);
    return channel;
  }

  public registerCommand(command: RuntimeCommand): void {
    this.requireContributed(Resources.commandsKind, command.info.name.text);
    this.registrations.push(this.commands.register(command));
  }

  public publishService(name: string, service: object): void {
    const qualified = QualifiedName.parse(name);
    if (qualified.owner !== this.declaration.id)
      throw new RegistrationException(Resources.formatServiceNotOwned(this.declaration.id, name));

    this.registrations.push(this.services.publish(qualified, service));
  }

  public getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T {
    const qualified = QualifiedName.parse(name);
    if (!qualified.isShell && !this.declaration.dependencies.includes(qualified.owner))
      throw new ServiceAccessException(Resources.formatServiceNotAllowed(this.declaration.id, name));

    const service = this.services.find(qualified);
    if (Object.isUndefined(service))
      throw new ServiceAccessException(Resources.formatServiceMissing(name));
    if (!(service instanceof type))
      throw new ServiceAccessException(Resources.formatServiceType(name, type.name));
    return service;
  }

  public [Symbol.dispose](): void {
    for (const registration of this.registrations.splice(0).reverse())
      registration[Symbol.dispose]();
  }

  private requireContributed(kind: string, name: string): QualifiedName {
    if (!this.declaration.listContributions(kind).includes(name))
      throw new RegistrationException(Resources.formatNotContributed(this.declaration.id, kind, name));
    return QualifiedName.parse(name);
  }
}
