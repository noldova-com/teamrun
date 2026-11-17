/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";

import { CheckpointsService, RuntimePart } from "@noldova/checkpoints/runtime";
import "@noldova/context.core";
import type { NotificationPost } from "@noldova/desktop.protocol";
import {
  EventChannel,
  NotificationHandle,
  OwnedProcess,
  ProcessExit,
  type ClientClosure,
  type IMethodHandler,
  type IModuleDatabase,
  type IModuleLog,
  type IModuleSettings,
  type IPermissionsContext,
  type IRuntimeFiles,
  type IRuntimePartContext,
  type IRuntimeWebViews,
  type IToolsContext,
  type ProcessRequest,
  type PseudoTerminal,
  type PseudoTerminalRequest,
  type RuntimeCommand,
  type WorkItem
} from "@noldova/desktop.runtime";
import type { JsonValue } from "@noldova/context.json";

import { TemporaryDirectory } from "./temporary-directory.fixture.js";

export class CheckpointsModule implements AsyncDisposable {
  public readonly service: CheckpointsService;
  public readonly context: CheckpointsPartContext;
  private readonly part: RuntimePart;
  private readonly folder: TemporaryDirectory;

  private constructor(part: RuntimePart, context: CheckpointsPartContext, folder: TemporaryDirectory) {
    this.part = part;
    this.context = context;
    this.folder = folder;
    this.service = context.services.get("checkpoints.service") as CheckpointsService;
  }

  public get services(): ReadonlyMap<string, object> {
    return this.context.services;
  }

  public static async startAsync(): Promise<CheckpointsModule> {
    const folder = new TemporaryDirectory();
    const context = new CheckpointsPartContext(folder.path);
    const part = new RuntimePart();
    await part.activateAsync(context);
    return new CheckpointsModule(part, context, folder);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.part.deactivateAsync();
    this.folder[Symbol.dispose]();
  }
}

export class CheckpointsPartContext implements IRuntimePartContext {
  private static readonly SHARED_NAMES: readonly string[] = ["PATH", "TEMP", "TMP", "TMPDIR"];
  private static readonly POSIX_NAMES: readonly string[] = ["HOME", "LANG", "LC_ALL"];
  private static readonly WINDOWS_NAMES: readonly string[] =
    ["SystemRoot", "windir", "PATHEXT", "ComSpec", "USERPROFILE", "SystemDrive", "LOCALAPPDATA", "APPDATA", "ProgramData", "ProgramFiles"];

  public readonly events: Map<string, JsonValue[]> = new Map();
  public readonly lines: string[] = [];
  public readonly log: IModuleLog = { write: t => { this.lines.push(t); } };
  public readonly methods: Map<string, IMethodHandler> = new Map();
  public readonly moduleFolder: string;
  public readonly moduleId: string = "checkpoints";
  public readonly services: Map<string, object> = new Map();
  public readonly settings: IModuleSettings;

  public constructor(moduleFolder: string) {
    this.moduleFolder = moduleFolder;
    const values = new Map<string, JsonValue>([["checkpoints.followIgnoreFiles", false]]);
    this.settings = {
      read: (name: string) => {
        const value = values.get(name);
        if (Object.isUndefined(value))
          throw new Error(`The checkpoints module declares no setting ${name}.`);
        return value;
      }
    } as IModuleSettings;
  }

  public get database(): IModuleDatabase {
    return CheckpointsPartContext.unused("database");
  }

  public get permissions(): IPermissionsContext {
    return CheckpointsPartContext.unused("permissions");
  }

  public get tools(): IToolsContext {
    return CheckpointsPartContext.unused("tools");
  }

  public get webViews(): IRuntimeWebViews {
    return CheckpointsPartContext.unused("webViews");
  }

  public get files(): IRuntimeFiles {
    return CheckpointsPartContext.unused("files");
  }

  public get secrets(): IRuntimePartContext["secrets"] {
    return CheckpointsPartContext.unused("secrets");
  }

  public get appWindows(): IRuntimePartContext["appWindows"] {
    return CheckpointsPartContext.unused("appWindows");
  }

  public get shortcuts(): IRuntimePartContext["shortcuts"] {
    return CheckpointsPartContext.unused("shortcuts");
  }

  public beginWork(_description: string): WorkItem {
    return CheckpointsPartContext.unused("beginWork");
  }

  public declareEvent(name: string): EventChannel {
    const published: JsonValue[] = [];
    this.events.set(name, published);
    return new EventChannel(t => published.push(t), () => this.events.delete(name));
  }

  public findService<T extends object>(_name: string, _guard: (service: object) => service is T): T | null {
    return CheckpointsPartContext.unused("findService");
  }

  public getService<T extends object>(_name: string, _type: abstract new (...args: never[]) => T): T {
    return CheckpointsPartContext.unused("getService");
  }

  public getWorkFolderAsync(): Promise<string> {
    return CheckpointsPartContext.unused("getWorkFolderAsync");
  }

  public onClientClosed(_listener: (closure: ClientClosure) => void | Promise<void>): void {
    CheckpointsPartContext.unused("onClientClosed");
  }

  public onDependencyChanged(_listener: (moduleId: string, isActive: boolean) => void): () => void {
    return CheckpointsPartContext.unused("onDependencyChanged");
  }

  public postNotification(_post: NotificationPost): NotificationHandle {
    return new NotificationHandle(crypto.randomUUID(), () => false, () => undefined);
  }

  public publishService(name: string, service: object): void {
    this.services.set(name, service);
  }

  public registerCommand(_command: RuntimeCommand): void {
    CheckpointsPartContext.unused("registerCommand");
  }

  public registerMethod(name: string, handler: IMethodHandler): void {
    this.methods.set(name, handler);
  }

  public async startProcessAsync(request: ProcessRequest): Promise<OwnedProcess> {
    request.signal?.throwIfAborted();
    const child = spawn(request.program, [...request.arguments], {
      cwd: request.workingFolder,
      env: CheckpointsPartContext.environmentOf(request),
      windowsHide: true
    });
    const stop = (): void => {
      child.kill();
    };
    request.signal?.addEventListener("abort", stop, { once: true });
    const exited = once(child, "close").then(([code, signal]) => {
      request.signal?.removeEventListener("abort", stop);
      return new ProcessExit(code as number | null, signal as NodeJS.Signals | null);
    });
    await once(child, "spawn");
    return new OwnedProcess(child, request.program, new Date(), exited, async () => {
      child.kill();
    });
  }

  public readEnvironmentAsync(): Promise<Readonly<Record<string, string>>> {
    return Promise.resolve(process.env as Readonly<Record<string, string>>);
  }

  public startPseudoTerminalAsync(_request: PseudoTerminalRequest): Promise<PseudoTerminal> {
    return CheckpointsPartContext.unused("startPseudoTerminalAsync");
  }

  private static environmentOf(request: ProcessRequest): NodeJS.ProcessEnv {
    const isWindows = process.platform === "win32";
    const same = (a: string, b: string): boolean => isWindows ? a.toUpperCase() === b.toUpperCase() : a === b;
    const environment: Record<string, string> = {};
    const set = (name: string, value: string): void => {
      for (const key of Object.keys(environment).filter(t => same(t, name)))
        delete environment[key];
      environment[name] = value;
    };
    const names = [...CheckpointsPartContext.SHARED_NAMES, ...isWindows ? CheckpointsPartContext.WINDOWS_NAMES : CheckpointsPartContext.POSIX_NAMES];
    for (const name of [...names, ...request.inherit]) {
      const value = Object.entries(process.env).find(([key]) => same(key, name))?.[1];
      if (!Object.isUndefined(value))
        set(name, value);
    }
    for (const [name, value] of Object.entries(request.environment))
      set(name, value);
    return environment;
  }

  private static unused(member: string): never {
    throw new Error(`The checkpoints runtime part doesn't use the context's ${member}.`);
  }
}
