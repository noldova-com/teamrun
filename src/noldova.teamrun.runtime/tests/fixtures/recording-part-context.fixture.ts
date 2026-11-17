/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir } from "node:os";

import type { NotificationPost } from "@noldova/desktop.protocol";
import {
  type ClientClosure,
  DiagnosticRedactor,
  EventChannel,
  type GrantedFile,
  type IFileShareOptions,
  type IMethodHandler,
  type IModuleDatabase,
  type IModuleLog,
  type IModuleSecrets,
  type IModuleSettings,
  type IPermissionsContext,
  type IRuntimeFiles,
  type IRuntimePartContext,
  type IRuntimeWebViews,
  NotificationHandle,
  type OwnedProcess,
  PermissionCenter,
  type ProcessRequest,
  type PseudoTerminal,
  type PseudoTerminalRequest,
  type RequestContext,
  type RuntimeCommand,
  WorkItem
} from "@noldova/desktop.runtime";
import { FakeRuntimeWebViews } from "@noldova/desktop.runtime/testing";
import type { JsonValue } from "@noldova/context.json";

import { CenterPermissionsContext } from "./center-permissions-context.fixture.js";
import { DeclaredSettings } from "./declared-settings.fixture.js";
import { GrantedFiles } from "./granted-files.fixture.js";
import { RegistryToolsContext } from "./registry-tools-context.fixture.js";

export class RecordingPartContext implements IRuntimePartContext {
  public readonly moduleId: string;
  public readonly moduleFolder: string;
  public readonly database: IModuleDatabase;
  public readonly lines: string[] = [];
  public readonly notifications: { readonly id: string; readonly post: NotificationPost; isShown: boolean }[] = [];
  public notificationFailure: Error | null = null;
  public readonly log: IModuleLog = { write: t => this.record(t) };
  public readonly tools: RegistryToolsContext;
  public readonly permissions: IPermissionsContext;
  public readonly workFolder: string;
  public readonly methods: Map<string, IMethodHandler> = new Map();
  public readonly published: Map<string, JsonValue[]> = new Map();
  public readonly openWork: Set<string> = new Set();
  public readonly services: ReadonlyMap<string, object>;
  public readonly requests: ProcessRequest[] = [];
  public settings: IModuleSettings = new DeclaredSettings();
  public environment: Readonly<Record<string, string>> = process.env as Readonly<Record<string, string>>;
  public startProcess: (request: ProcessRequest) => Promise<OwnedProcess> = () => Promise.reject(new Error("The fixture starts no programs."));
  public refusedMethod: string | null = null;
  public onPublished: ((name: string, payload: JsonValue) => void) | null = null;
  public beganWork: number = 0;
  public readonly shares: { readonly file: string; readonly request: RequestContext; readonly options: IFileShareOptions | undefined }[] = [];
  public readonly granted: GrantedFiles = new GrantedFiles();
  public readonly saved: Map<string, string> = new Map();
  public readonly secrets: IModuleSecrets = {
    saveAsync: (name, value) => { this.saved.set(name, value); return Promise.resolve(); },
    readAsync: name => Promise.resolve(this.saved.get(name) ?? null),
    removeAsync: name => { this.saved.delete(name); return Promise.resolve(); },
    isSetAsync: name => Promise.resolve(this.saved.has(name))
  };
  private readonly views: FakeRuntimeWebViews = RecordingPartContext.viewsWithNone();
  private workEnded: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly closureListeners: ((closure: ClientClosure) => void | Promise<void>)[] = [];
  private readonly ownServices: Map<string, object> = new Map();
  private readonly lineWaiters: { readonly line: string; readonly resolve: () => void }[] = [];
  private readonly eventWaiters: { readonly name: string; readonly resolve: (payload: JsonValue) => void }[] = [];

  public constructor(moduleFolder: string, database: IModuleDatabase, workFolder: string = moduleFolder, services: ReadonlyMap<string, object> = new Map(),
    permissionsModule: string = "teamrun", moduleId: string = "teamrun", declaredTools?: readonly string[]) {
    this.moduleId = moduleId;
    this.tools = new RegistryToolsContext(this.moduleId, this.log, declaredTools, new PermissionCenter(permissionsModule));
    this.permissions = new CenterPermissionsContext(this.tools.center, this.moduleId, this.log);
    this.moduleFolder = moduleFolder;
    this.database = database;
    this.workFolder = workFolder;
    this.services = services;
  }

  public get webViews(): IRuntimeWebViews {
    return this.views;
  }

  public get appWindows(): IRuntimePartContext["appWindows"] {
    return { list: () => [], onChanged: () => () => undefined };
  }

  public get shortcuts(): IRuntimePartContext["shortcuts"] {
    return { list: () => [], has: () => false, onChanged: () => () => undefined };
  }

  public get files(): IRuntimeFiles {
    return {
      redeemAsync: (grant: string, request: RequestContext): Promise<GrantedFile> => this.granted.redeemAsync(grant, request),
      shareAsync: (file: string, request: RequestContext, options?: IFileShareOptions): Promise<string> => {
        this.shares.push({ file, request, options });
        return Promise.resolve(this.shares.length.toString(16).padStart(32, "0"));
      }
    };
  }

  public getWorkFolderAsync(): Promise<string> {
    return Promise.resolve(this.workFolder);
  }

  public beginWork(description: string): WorkItem {
    this.beganWork++;
    this.openWork.add(description);
    return new WorkItem(description, t => {
      this.openWork.delete(t.description);
      this.workEnded.resolve();
      this.workEnded = Promise.withResolvers<void>();
    });
  }

  public whenWorkEnds(): Promise<void> {
    return this.workEnded.promise;
  }

  public whenPublished(name: string): Promise<JsonValue> {
    const [first] = this.published.get(name) ?? [];
    if (!Object.isUndefined(first))
      return Promise.resolve(first);
    const published = Promise.withResolvers<JsonValue>();
    this.eventWaiters.push({ name, resolve: published.resolve });
    return published.promise;
  }

  public whenLogged(line: string): Promise<void> {
    if (this.lines.includes(line))
      return Promise.resolve();
    const logged = Promise.withResolvers<void>();
    this.lineWaiters.push({ line, resolve: logged.resolve });
    return logged.promise;
  }

  public startProcessAsync(request: ProcessRequest): Promise<OwnedProcess> {
    this.requests.push(request);
    return this.startProcess(request);
  }

  public readEnvironmentAsync(): Promise<Readonly<Record<string, string>>> {
    return Promise.resolve(this.environment);
  }

  public startPseudoTerminalAsync(_request: PseudoTerminalRequest): Promise<PseudoTerminal> {
    return Promise.reject(new Error("The fixture starts no pseudo-terminals."));
  }

  public registerMethod(name: string, handler: IMethodHandler): void {
    if (name === this.refusedMethod)
      throw new Error(`The fixture refuses ${name}.`);
    this.methods.set(name, handler);
  }

  public declareEvent(name: string): EventChannel {
    this.published.set(name, []);
    return new EventChannel(t => {
      this.published.get(name)?.push(t);
      this.onPublished?.(name, t);
      for (const waiter of this.eventWaiters.filter(u => u.name === name))
        waiter.resolve(t);
    }, () => this.published.delete(name));
  }

  public registerCommand(_command: RuntimeCommand): void {
    throw new Error("The fixture registers no commands.");
  }

  public onClientClosed(listener: (closure: ClientClosure) => void | Promise<void>): void {
    this.closureListeners.push(listener);
  }

  public async closeClientAsync(closure: ClientClosure): Promise<void> {
    for (const listener of this.closureListeners)
      await listener(closure);
  }

  public postNotification(post: NotificationPost): NotificationHandle {
    if (!Object.isNull(this.notificationFailure))
      throw this.notificationFailure;
    const replaced = this.notifications.filter(t => t.isShown && !Object.isNull(post.key) && t.post.kind.text === post.kind.text && t.post.key === post.key);
    for (const notice of replaced)
      notice.isShown = false;
    const posted = { id: replaced.at(0)?.id ?? String(this.notifications.length + 1), post, isShown: true };
    this.notifications.push(posted);
    return new NotificationHandle(posted.id, () => posted.isShown, () => {
      for (const notice of this.notifications.filter(t => t.id === posted.id))
        notice.isShown = false;
    });
  }

  public shownNotices(): readonly NotificationPost[] {
    return this.notifications.filter(t => t.isShown).map(t => t.post);
  }

  public publishService(name: string, service: object): void {
    this.ownServices.set(name, service);
  }

  public getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T {
    const service = this.services.get(name) ?? this.ownServices.get(name);
    if (!(service instanceof type))
      throw new Error(`The fixture has no service ${name} of the type ${type.name}.`);
    return service;
  }

  public findService<T extends object>(name: string, guard: (service: object) => service is T): T | null {
    const service = this.services.get(name) ?? this.ownServices.get(name);
    return Object.isUndefined(service) || !guard(service) ? null : service;
  }

  public onDependencyChanged(_listener: (moduleId: string, isActive: boolean) => void): () => void {
    throw new Error("The fixture has no optional dependencies.");
  }

  private record(text: string): void {
    const line = new DiagnosticRedactor(homedir()).redact(text);
    this.lines.push(line);
    for (const waiter of this.lineWaiters.filter(t => t.line === line))
      waiter.resolve();
  }

  private static viewsWithNone(): FakeRuntimeWebViews {
    const views = new FakeRuntimeWebViews();
    views.answer("list", () => []);
    return views;
  }
}
