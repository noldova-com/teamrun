/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { inspect } from "node:util";

import "@noldova/teamrun-foundation-core";
import { type BuildIdentity, Failure, FailureCode, NotificationBroadcast, PreShellData, RuntimeHandover, ShellEvents, ShellMethods } from "@noldova/teamrun-shell-protocol";

import { DataDirectoryState } from "../../enums/data-directory-state.js";
import { WindowStateKind } from "../../enums/window-state-kind.js";
import { DataDirectoryOwnedException } from "../../exceptions/data-directory-owned.exception.js";
import type { IIdleParticipant } from "../../interfaces/i-idle-participant.js";
import { CapabilityToken } from "../../models/capability-token.js";
import type { Endpoint } from "../../models/endpoint.js";
import type { EventChannel } from "../../models/event-channel.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { ProductInfo } from "../../models/product-info.js";
import { Refusal } from "../../models/refusal.js";
import { RuntimeBuild } from "../../models/runtime-build.js";
import { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import type { RunningProgram } from "../../models/running-program.js";
import type { RuntimeOptions } from "../../models/runtime-options.js";
import { Resources } from "../../resources.js";
import { SystemCommand } from "../commands/system-command.js";
import { DataDirectoryInspector } from "../data-directory/data-directory-inspector.js";
import { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { ShellDatabase } from "../database/shell-database.js";
import { ShellMigrations } from "../database/shell-migrations.js";
import { DiscoveryPublisher } from "../discovery/discovery-publisher.js";
import { FolderProtectorFactory } from "../discovery/folder-protector-factory.js";
import { RuntimeServer } from "../endpoint/runtime-server.js";
import { ModuleDeclarationReader } from "../modules/module-declaration.reader.js";
import { CommandsMethod } from "../modules/commands-method.js";
import { ModuleHost } from "../modules/module-host.js";
import { ModulesMethod } from "../modules/modules-method.js";
import { RunCommandMethod } from "../modules/run-command-method.js";
import { ClearNotificationsMethod } from "../notifications/clear-notifications-method.js";
import { DismissNotificationMethod } from "../notifications/dismiss-notification-method.js";
import { MarkNotificationsReadMethod } from "../notifications/mark-notifications-read-method.js";
import { NotificationCenter } from "../notifications/notification-center.js";
import { NotificationSettings } from "../notifications/notification-settings.js";
import { NotificationsMethod } from "../notifications/notifications-method.js";
import { PostNotificationMethod } from "../notifications/post-notification-method.js";
import { UpdateNotificationMethod } from "../notifications/update-notification-method.js";
import { PackageRuntimePartLoader } from "../modules/package-runtime-part-loader.js";
import { OwnershipLock } from "../ownership/ownership-lock.js";
import { ProcessSupervisor } from "../process/process-supervisor.js";
import { RecentCommandsMethod } from "../recent-commands/recent-commands-method.js";
import { RecentCommandsStore } from "../recent-commands/recent-commands-store.js";
import { RecordCommandMethod } from "../recent-commands/record-command-method.js";
import { CommandRegistry } from "../registry/command-registry.js";
import { EventRegistry } from "../registry/event-registry.js";
import { MethodRegistry } from "../registry/method-registry.js";
import { SettingReadMethod } from "../settings/setting-read-method.js";
import { SettingResetMethod } from "../settings/setting-reset-method.js";
import { SettingWriteMethod } from "../settings/setting-write-method.js";
import { SettingsReadMethod } from "../settings/settings-read-method.js";
import { SettingsService } from "../settings/settings.service.js";
import { ShellSettings } from "../settings/shell-settings.js";
import { WindowStateReadMethod } from "../window-state/window-state-read-method.js";
import { WindowStateStore } from "../window-state/window-state-store.js";
import { WindowStateWriteMethod } from "../window-state/window-state-write-method.js";
import { WorkMethod } from "../work/work-method.js";
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
  private readonly platform: string;
  private readonly environment: NodeJS.ProcessEnv;
  private database: ShellDatabase | null;
  private settings: SettingsService | null = null;
  private processes: ProcessSupervisor | null = null;
  private discovery: RuntimeDiscovery | null = null;
  private movingAside: Promise<void> | null = null;
  private isStopping: boolean = false;
  private notificationSettings: NotificationSettings = new NotificationSettings(null);
  private readonly workEvent: EventChannel;

  public readonly identity: BuildIdentity;
  public readonly work: WorkTracker;
  public readonly methods: MethodRegistry = new MethodRegistry();
  public readonly commands: CommandRegistry;
  public readonly events: EventRegistry;
  public readonly notifications: NotificationCenter;
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
    this.platform = platform;
    this.environment = environment;
    this.log = log;
    this.database = database;
    this.identity = RuntimeBuild.identity;
    this.work = new WorkTracker(() => this.workChanged());
    this.server = new RuntimeServer(
      this.identity,
      this.token,
      new RuntimeHandover(this.identity, process.execPath),
      this.methods,
      options.serverSettings,
      () => this.idle.check(),
      log.diagnostics);
    this.events = new EventRegistry(this.server);
    this.publisher = new DiscoveryPublisher(lock, FolderProtectorFactory.create(platform, new SystemCommand(), environment));
    this.idle = new IdleMonitor(options.idleGraceMilliseconds, this);
    this.workEvent = this.events.declare(ShellEvents.work);
    const commandsChanged = this.events.declare(ShellEvents.commandsChanged);
    this.commands = new CommandRegistry(t => commandsChanged.publish(t.toJson()));
    const notificationsChanged = this.events.declare(ShellEvents.notifications);
    this.notifications = new NotificationCenter(
      t => notificationsChanged.publish(new NotificationBroadcast(t.notifications, this.notificationSettings.quietDevices, this.notificationSettings.mutedModules, this.notifications.sequence).toJson()), () => new Date(), randomUUID);
    this.modules = new ModuleHost(
      declarations, lock.dataDirectory, this.methods, this.events, this.commands, this.notifications, new PackageRuntimePartLoader(), log.diagnostics,
      this.work, new DiagnosticRedactor(homedir()));
    this.methods.register(ShellMethods.stop, new StopMethod(this.work, t => this.requestStop(t)));
    this.methods.register(ShellMethods.modules, new ModulesMethod(this.modules));
    this.methods.register(ShellMethods.work, new WorkMethod(this.work));
    this.methods.register(ShellMethods.commands, new CommandsMethod(this.commands));
    this.methods.register(ShellMethods.runCommand, new RunCommandMethod(this.commands));
    if (!Object.isNull(database))
      this.registerShellFacilities(database);
    else {
      this.server.refuse(new Refusal(
        new Failure(FailureCode.PreShellData, Resources.formatPreShellDataFailure(ProductInfo.current.name), new PreShellData(lock.dataDirectory.root).toJson()),
        ShellMethods.moveAside));
      this.methods.register(ShellMethods.moveAside, new MoveAsideMethod(() => this.moveAsideAsync()));
    }
  }

  public get programs(): readonly RunningProgram[] {
    return this.processes?.programs ?? [];
  }

  public get isIdle(): boolean {
    return this.server.sessionCount === 0 && this.work.isEmpty;
  }

  public static async startAsync(options: RuntimeOptions, platform: string, environment: NodeJS.ProcessEnv): Promise<RuntimeHost> {
    const declarations = await ModuleDeclarationReader.readAsync(options.declarationsFile);
    const lock = await RuntimeHost.acquireAsync(options);
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

  private workChanged(): void {
    this.workEvent.publish(this.work.report.toJson());
    this.idle.check();
  }

  private static async acquireAsync(options: RuntimeOptions): Promise<OwnershipLock> {
    const deadline = Date.now() + options.takeoverMilliseconds;
    for (;;) {
      try {
        return OwnershipLock.acquire(options.dataDirectory);
      }
      catch (error) {
        if (!(error instanceof DataDirectoryOwnedException) || existsSync(options.dataDirectory.discoveryFile) || Date.now() >= deadline)
          throw error;
      }
      await delay(Resources.takeoverInterval);
    }
  }

  private async openAsync(platform: string): Promise<void> {
    await this.publisher.withdrawEarlierAsync();
    if (!Object.isNull(this.database) && !Object.isNull(this.settings))
      await this.activateModulesAsync(this.database, this.settings);
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
    await this.activateModulesAsync(this.database, this.registerShellFacilities(this.database));
    setImmediate(() => this.server.admit());
  }

  private async activateModulesAsync(database: ShellDatabase, settings: SettingsService): Promise<void> {
    const processes = new ProcessSupervisor(database, this.platform, this.environment, new SystemCommand(), this.log.diagnostics);
    this.processes = processes;
    await processes.cleanUpAsync();
    await this.modules.activateAsync(settings, processes);
  }

  private registerShellFacilities(database: ShellDatabase): SettingsService {
    const store = new WindowStateStore(database);
    const settings = new SettingsService(database, [...ShellSettings.all, ...this.modules.settingDefinitions], this.log.diagnostics);
    const changed = this.events.declare(ShellEvents.settingsChanged);
    this.notificationSettings = new NotificationSettings(settings);
    settings.onChanged(t => {
      changed.publish(t.toJson());
      if (this.notificationSettings.isNotificationSetting(t.key.name.text))
        this.notifications.republish();
    });
    this.methods.register(ShellMethods.settings, new SettingsReadMethod(settings));
    this.methods.register(ShellMethods.readSetting, new SettingReadMethod(settings));
    this.methods.register(ShellMethods.setSetting, new SettingWriteMethod(settings));
    this.methods.register(ShellMethods.resetSetting, new SettingResetMethod(settings));
    this.settings = settings;
    this.methods.register(ShellMethods.readWindowBounds, new WindowStateReadMethod(store, WindowStateKind.Bounds));
    this.methods.register(ShellMethods.writeWindowBounds, new WindowStateWriteMethod(store, WindowStateKind.Bounds));
    this.methods.register(ShellMethods.readWindowLayout, new WindowStateReadMethod(store, WindowStateKind.Layout));
    this.methods.register(ShellMethods.writeWindowLayout, new WindowStateWriteMethod(store, WindowStateKind.Layout));
    this.methods.register(ShellMethods.notifications, new NotificationsMethod(this.notifications, this.notificationSettings));
    this.methods.register(ShellMethods.postNotification, new PostNotificationMethod(this.notifications, this.modules.notificationPolicy));
    this.methods.register(ShellMethods.updateNotification, new UpdateNotificationMethod(this.notifications, this.modules.notificationPolicy));
    this.methods.register(ShellMethods.dismissNotification, new DismissNotificationMethod(this.notifications));
    this.methods.register(ShellMethods.markNotificationsRead, new MarkNotificationsReadMethod(this.notifications));
    this.methods.register(ShellMethods.clearNotifications, new ClearNotificationsMethod(this.notifications));
    const recent = new RecentCommandsStore(database);
    this.methods.register(ShellMethods.recentCommands, new RecentCommandsMethod(recent));
    this.methods.register(ShellMethods.recordCommand, new RecordCommandMethod(recent, this.events.declare(ShellEvents.recentCommandsChanged)));
    return settings;
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
        await this.processes?.stopAllAsync();
        if (!Object.isNull(this.discovery))
          await this.publisher.withdrawAsync(this.discovery);
      }
    }
    catch (error) {
      this.log.writeLine(inspect(error));
      throw error;
    }
    finally {
      try {
        this.database?.close();
        await this.log.closeAsync();
      }
      finally {
        this.lock.release();
      }
    }
  }
}
