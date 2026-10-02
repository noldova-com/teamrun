/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { inspect } from "node:util";

import "@noldova/teamrun-foundation-core";
import { type BuildIdentity, Failure, FailureCode, PreShellData, RuntimeHandover, ShellMethods } from "@noldova/teamrun-shell-protocol";

import { DataDirectoryState } from "../../enums/data-directory-state.js";
import { WindowStateKind } from "../../enums/window-state-kind.js";
import type { IIdleParticipant } from "../../interfaces/idle-participant.js";
import { CapabilityToken } from "../../models/capability-token.js";
import type { Endpoint } from "../../models/endpoint.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Refusal } from "../../models/refusal.js";
import { RuntimeBuild } from "../../models/runtime-build.js";
import { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import type { RuntimeOptions } from "../../models/runtime-options.js";
import { Resources } from "../../resources.js";
import { SystemCommand } from "../commands/system-command.js";
import { DataDirectoryInspector } from "../data-directory/data-directory-inspector.js";
import { ShellDatabase } from "../database/shell-database.js";
import { ShellMigrations } from "../database/shell-migrations.js";
import { DiscoveryPublisher } from "../discovery/discovery-publisher.js";
import { FolderProtectorFactory } from "../discovery/folder-protector-factory.js";
import { RuntimeServer } from "../endpoint/runtime-server.js";
import { ModuleDeclarationReader } from "../modules/module-declaration.reader.js";
import { ModuleHost } from "../modules/module-host.js";
import { ModulesMethod } from "../modules/modules-method.js";
import { PackageRuntimePartLoader } from "../modules/package-runtime-part-loader.js";
import { OwnershipLock } from "../ownership/ownership-lock.js";
import { EventRegistry } from "../registry/event-registry.js";
import { MethodRegistry } from "../registry/method-registry.js";
import { WindowStateReadMethod } from "../window-state/window-state-read-method.js";
import { WindowStateStore } from "../window-state/window-state-store.js";
import { WindowStateWriteMethod } from "../window-state/window-state-write-method.js";
import { WorkTracker } from "../work/work-tracker.js";
import { IdleMonitor } from "./idle-monitor.js";
import { MoveAsideMethod } from "./move-aside-method.js";
import { RuntimeLog } from "./runtime-log.js";
import { StopMethod } from "./stop-method.js";

export class RuntimeHost implements IIdleParticipant {
  private readonly lock: OwnershipLock;
  private readonly token: CapabilityToken = CapabilityToken.generate();
  private readonly server: RuntimeServer;
  private readonly publisher: DiscoveryPublisher;
  private readonly idle: IdleMonitor;
  private readonly stopped: PromiseWithResolvers<string> = Promise.withResolvers<string>();
  private database: ShellDatabase | null;
  private discovery: RuntimeDiscovery | null = null;
  private movingAside: Promise<void> | null = null;
  private isStopping: boolean = false;

  public readonly identity: BuildIdentity;
  public readonly work: WorkTracker;
  public readonly methods: MethodRegistry = new MethodRegistry();
  public readonly events: EventRegistry;
  public readonly modules: ModuleHost;
  public readonly log: RuntimeLog;

  private constructor(
    options: RuntimeOptions,
    platform: string,
    environment: NodeJS.ProcessEnv,
    lock: OwnershipLock,
    log: RuntimeLog,
    database: ShellDatabase | null,
    declarations: readonly ModuleDeclaration[]) {
    this.lock = lock;
    this.log = log;
    this.database = database;
    this.identity = RuntimeBuild.identity;
    this.work = new WorkTracker(() => this.idle.check());
    this.server = new RuntimeServer(
      this.identity,
      this.token,
      new RuntimeHandover(this.identity, process.execPath),
      this.methods,
      options.serverSettings,
      () => this.idle.check());
    this.events = new EventRegistry(this.server);
    this.publisher = new DiscoveryPublisher(lock, FolderProtectorFactory.create(platform, new SystemCommand(), environment));
    this.idle = new IdleMonitor(options.idleGraceMilliseconds, this);
    this.modules = new ModuleHost(declarations, lock.dataDirectory, this.methods, this.events, new PackageRuntimePartLoader(), log.diagnostics);
    this.methods.register(ShellMethods.stop, new StopMethod(this.work, t => this.requestStop(t)));
    this.methods.register(ShellMethods.modules, new ModulesMethod(this.modules));
    if (!Object.isNull(database))
      this.registerShellFacilities(database);
    else {
      this.server.refuse(new Refusal(
        new Failure(FailureCode.PreShellData, Resources.preShellData, new PreShellData(lock.dataDirectory.root).toJson()),
        ShellMethods.moveAside));
      this.methods.register(ShellMethods.moveAside, new MoveAsideMethod(() => this.moveAsideAsync()));
    }
  }

  public get isIdle(): boolean {
    return this.server.sessionCount === 0 && this.work.isEmpty;
  }

  public static async startAsync(options: RuntimeOptions, platform: string, environment: NodeJS.ProcessEnv): Promise<RuntimeHost> {
    const declarations = await ModuleDeclarationReader.readAsync(options.declarationsFile);
    const lock = OwnershipLock.acquire(options.dataDirectory);
    let log: RuntimeLog | null = null;
    let database: ShellDatabase | null = null;
    try {
      log = await RuntimeLog.openAsync(lock, options.startLogName);
      const inspection = await DataDirectoryInspector.inspectAsync(options.dataDirectory);
      if (inspection.state !== DataDirectoryState.PreShell)
        database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    }
    catch (error) {
      await log?.closeAsync();
      lock.release();
      throw error;
    }

    const host = new RuntimeHost(options, platform, environment, lock, log, database, declarations);
    try {
      await host.openAsync(platform);
    }
    catch (error) {
      await host.stopAsync();
      throw error;
    }
    return host;
  }

  public handleIdle(): void {
    this.requestStop(Resources.stoppedByIdle);
  }

  public requestStop(reason: string): void {
    if (!this.isStopping)
      this.stopAsync().then(() => this.stopped.resolve(reason), (error: unknown) => this.stopped.reject(error));
  }

  public waitForStopAsync(): Promise<string> {
    return this.stopped.promise;
  }

  private async openAsync(platform: string): Promise<void> {
    if (!Object.isNull(this.database))
      await this.modules.activateAsync();
    const endpoint = await this.listenAsync(platform);
    const discovery = new RuntimeDiscovery(
      endpoint.toString(),
      this.token.value,
      process.pid,
      process.execPath,
      this.identity.productVersion,
      this.identity.protocolVersion,
      this.identity.fingerprint);
    await this.publisher.publishAsync(discovery);
    this.discovery = discovery;
    this.idle.check();
  }

  private moveAsideAsync(): Promise<void> {
    this.movingAside ??= this.performMoveAsideAsync();
    return this.movingAside;
  }

  private async performMoveAsideAsync(): Promise<void> {
    await DataDirectoryInspector.moveAsideAsync(this.lock);
    this.database = await ShellDatabase.openAsync(this.lock, ShellMigrations.all);
    this.registerShellFacilities(this.database);
    await this.modules.activateAsync();
    setImmediate(() => this.server.admit());
  }

  private registerShellFacilities(database: ShellDatabase): void {
    const store = new WindowStateStore(database);
    this.methods.register(ShellMethods.readWindowBounds, new WindowStateReadMethod(store, WindowStateKind.Bounds));
    this.methods.register(ShellMethods.writeWindowBounds, new WindowStateWriteMethod(store, WindowStateKind.Bounds));
    this.methods.register(ShellMethods.readWindowLayout, new WindowStateReadMethod(store, WindowStateKind.Layout));
    this.methods.register(ShellMethods.writeWindowLayout, new WindowStateWriteMethod(store, WindowStateKind.Layout));
  }

  private async listenAsync(platform: string): Promise<Endpoint> {
    if (platform === Resources.windowsPlatform)
      return this.server.listenTcpAsync();

    const folder = this.lock.dataDirectory.discoveryFolder;
    await mkdir(folder, { recursive: true, mode: Resources.privateFolderMode });
    return this.server.listenSocketAsync(path.join(folder, Resources.socketFileName));
  }

  private async stopAsync(): Promise<void> {
    this.isStopping = true;
    this.idle[Symbol.dispose]();
    this.work.cancelAll();
    try {
      await this.server.closeAsync();
      try {
        await this.modules.deactivateAsync();
      }
      finally {
        if (!Object.isNull(this.discovery))
          await this.publisher.withdrawAsync(this.discovery);
      }
    }
    catch (error) {
      this.log.writeLine(inspect(error));
      throw error;
    }
    finally {
      this.database?.close();
      this.lock.release();
      await this.log.closeAsync();
    }
  }
}
