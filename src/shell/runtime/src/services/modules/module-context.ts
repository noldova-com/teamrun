/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import type { Writable } from "node:stream";

import "@noldova/teamrun-foundation-core";
import { type NotificationPost, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { ModuleDatabaseException } from "../../exceptions/module-database.exception.js";
import { RegistrationException } from "../../exceptions/registration.exception.js";
import { ServiceAccessException } from "../../exceptions/service-access.exception.js";
import type { IMethodHandler } from "../../interfaces/method-handler.js";
import type { IModuleDatabase } from "../../interfaces/module-database.js";
import type { IModuleLog } from "../../interfaces/module-log.js";
import type { IModuleSettings } from "../../interfaces/module-settings.js";
import type { IRuntimePartContext } from "../../interfaces/runtime-part-context.js";
import type { EventChannel } from "../../models/event-channel.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { NotificationHandle } from "../../models/notification-handle.js";
import type { OwnedProcess } from "../../models/owned-process.js";
import type { ProcessRequest } from "../../models/process-request.js";
import type { RuntimeCommand } from "../../models/runtime-command.js";
import type { WorkItem } from "../../models/work-item.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import type { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import type { NotificationCenter } from "../notifications/notification-center.js";
import type { NotificationPolicy } from "../notifications/notification-policy.js";
import type { ProcessSupervisor } from "../process/process-supervisor.js";
import type { CommandRegistry } from "../registry/command-registry.js";
import type { EventRegistry } from "../registry/event-registry.js";
import type { MethodRegistry } from "../registry/method-registry.js";
import type { ServiceRegistry } from "../registry/service-registry.js";
import { ModuleSettings } from "../settings/module-settings.js";
import type { SettingsService } from "../settings/settings-service.js";
import type { WorkTracker } from "../work/work-tracker.js";
import { ModuleLog } from "./module-log.js";

export class ModuleContext implements IRuntimePartContext, Disposable {
  private readonly declaration: ModuleDeclaration;
  private readonly methods: MethodRegistry;
  private readonly events: EventRegistry;
  private readonly commands: CommandRegistry;
  private readonly notifications: NotificationCenter;
  private readonly notificationPolicy: NotificationPolicy;
  private readonly services: ServiceRegistry;
  private readonly work: WorkTracker;
  private readonly processes: ProcessSupervisor;
  private readonly workFolder: string;
  private readonly registrations: Disposable[] = [];
  private readonly moduleDatabase?: IModuleDatabase;

  public readonly moduleFolder: string;
  public readonly settings: IModuleSettings;
  public readonly log: IModuleLog;

  public constructor(
    declaration: ModuleDeclaration,
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    notifications: NotificationCenter,
    notificationPolicy: NotificationPolicy,
    services: ServiceRegistry,
    settings: SettingsService,
    work: WorkTracker,
    processes: ProcessSupervisor,
    diagnostics: Writable,
    redactor: DiagnosticRedactor,
    database?: IModuleDatabase) {
    this.declaration = declaration;
    if (!Object.isUndefined(database))
      this.moduleDatabase = database;
    this.methods = methods;
    this.events = events;
    this.commands = commands;
    this.notifications = notifications;
    this.notificationPolicy = notificationPolicy;
    this.services = services;
    this.work = work;
    this.processes = processes;
    this.moduleFolder = dataDirectory.locateModuleFolder(declaration.id);
    this.workFolder = dataDirectory.locateWorkFolder(declaration.id);
    this.settings = new ModuleSettings(declaration, settings, this.registrations);
    this.log = new ModuleLog(declaration.id, diagnostics, redactor);
  }

  public get moduleId(): string {
    return this.declaration.id;
  }

  public get database(): IModuleDatabase {
    if (Object.isUndefined(this.moduleDatabase))
      throw new ModuleDatabaseException(Resources.formatNoModuleDatabase(this.declaration.id));
    return this.moduleDatabase;
  }

  public async getWorkFolderAsync(): Promise<string> {
    await mkdir(this.workFolder, { recursive: true });
    return this.workFolder;
  }

  public beginWork(description: string): WorkItem {
    return this.work.begin(description, this.declaration.id);
  }

  public startProcessAsync(request: ProcessRequest): Promise<OwnedProcess> {
    return this.processes.startAsync(this.declaration.id, request);
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

  public postNotification(post: NotificationPost): NotificationHandle {
    this.notificationPolicy.requireDeclared(this.declaration, post);
    const id = this.notifications.post(post);
    return new NotificationHandle(id, t => this.updateNotification(id, t), () => this.notifications.dismiss(id));
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
    this.notifications.dismissOwnedBy(this.declaration.id);
    this.work.endOwnedBy(this.declaration.id);
  }

  private updateNotification(id: number, post: NotificationPost): void {
    this.notificationPolicy.requireDeclared(this.declaration, post);
    if (!this.notifications.update(id, post))
      throw new RegistrationException(Resources.formatNotificationNotFound(id));
  }

  private requireContributed(kind: string, name: string): QualifiedName {
    if (!this.declaration.listContributions(kind).includes(name))
      throw new RegistrationException(Resources.formatNotContributed(this.declaration.id, kind, name));
    return QualifiedName.parse(name);
  }
}
