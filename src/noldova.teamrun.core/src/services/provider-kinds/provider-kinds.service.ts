/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import {
  ErrorCode,
  Event,
  EventName,
  type PlanUsage,
  type PlanUsageParams,
  type Provider,
  type ProviderKind,
  type ProviderKindParams,
  ProviderKindInstallation,
  ProviderKindInstallState,
  type ProviderListModelsParams,
  type ProviderModelList,
  type ProviderTool
} from "@noldova/teamrun.protocol";

import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IPlanUsageService } from "../../interfaces/i-plan-usage.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { IProviderKindInstallation } from "../../interfaces/i-provider-kind-installation.js";
import { ProviderKindVersions } from "../../models/provider-kind-versions.js";
import type { IProviderKindsService } from "../../interfaces/i-provider-kinds.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import type { IToolUpdateChecks } from "../../interfaces/i-tool-update-checks.js";
import { InstalledKind } from "../../models/installed-kind.js";
import { ProviderKindInstallRun } from "../../models/provider-kind-install-run.js";
import { ProviderKindsRead } from "../../models/provider-kinds-read.js";
import { Resources } from "../../resources.js";
import { PlanUsageService } from "./plan-usage.service.js";
import type { ProviderKindRegistry } from "./provider-kind-registry.js";

export class ProviderKindsService implements IProviderKindsService {
  private readonly registry: ProviderKindRegistry;
  private readonly providers: IProvidersService;
  private readonly events: IEventSink;
  private readonly planUsage: IPlanUsageService;
  private readonly teammates: ITeammatesService | null;
  private readonly log: ILog | null;
  private readonly updateChecks: IToolUpdateChecks;
  private readonly installs: Map<string, ProviderKindInstallRun> = new Map();
  private readonly failures: Map<string, string> = new Map();
  private readonly versions: Map<string, ProviderKindVersions> = new Map();
  private readonly reads: Map<string, ProviderKindsRead> = new Map();
  private listed: boolean = false;

  public constructor(registry: ProviderKindRegistry, providers: IProvidersService, events: IEventSink, updateChecks: IToolUpdateChecks,
    planUsage: IPlanUsageService = new PlanUsageService(events), teammates: ITeammatesService | null = null, log: ILog | null = null) {
    this.registry = registry;
    this.providers = providers;
    this.events = events;
    this.updateChecks = updateChecks;
    this.planUsage = planUsage;
    this.teammates = teammates;
    this.log = log;
    updateChecks.onAllowed(() => this.checkListed());
  }

  public list(): readonly ProviderKind[] {
    return this.registry.all().map(t => t.descriptor.withNamesChats(!Object.isUndefined(t.askIsolated)));
  }

  public async listAsync(): Promise<readonly ProviderKind[]> {
    await Promise.all(this.registry.all().map(t => t.refreshDescriptorAsync?.().catch((error: unknown) =>
      this.log?.write(Resources.formatDescriptorNotRefreshed(t.descriptor.id, error instanceof Error ? error.name : typeof error)))));
    return this.list();
  }

  public async listModelsAsync(params: ProviderListModelsParams): Promise<readonly string[]> {
    return (await this.modelCatalogAsync(params)).models.map(t => t.id);
  }

  public async modelCatalogAsync(params: ProviderListModelsParams): Promise<ProviderModelList> {
    const adapter = this.registry.get(params.kind);
    const provider = await this.resolveProviderAsync(params.kind, params.providerId);
    if (provider?.enabled === false)
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatProviderDisabled(provider.label), [provider.id]);
    const list = await adapter.listModels(provider, params.refresh, params.workingDirectory);
    if (!Object.isNull(provider) && !list.partial && Object.isNull(params.workingDirectory))
      await this.teammates?.clearUnlistedAsync(provider.id, list);
    const planMode = adapter.planMode ?? null;
    return !Object.isNull(planMode) && list.modes.some(t => t.id === planMode) ? list.withPlanMode(planMode) : list;
  }

  public listInstallations(): Promise<readonly ProviderKindInstallation[]> {
    const installed = this.installed();
    this.listed = true;
    const checksLatest = this.updateChecks.takeCheck();
    for (const entry of installed)
      void this.readVersions(entry.kind, entry.installation, checksLatest);
    return Promise.resolve(installed.map(t => this.describe(t.kind, t.installation)));
  }

  public async checkInstallationsAsync(): Promise<readonly ProviderKindInstallation[]> {
    const installed = this.installed();
    await Promise.all(installed.map(t => this.readVersions(t.kind, t.installation, true)));
    return installed.map(t => this.describe(t.kind, t.installation));
  }

  public listTools(): Promise<readonly ProviderTool[]> {
    return Promise.all(this.registry.tools().map(t => t.check()));
  }

  public install(params: ProviderKindParams): Promise<ProviderKindInstallation> {
    const installation = this.requireInstallation(params.kind);
    const running = this.installs.get(params.kind)?.done ?? null;
    if (!Object.isNull(running))
      return running;
    const current = this.describe(params.kind, installation);
    if (current.state === ProviderKindInstallState.Installed && Object.isNull(current.update))
      return Promise.resolve(current);
    if (current.state === ProviderKindInstallState.Unavailable && !Object.isNull(current.reason))
      throw new ServiceException(ErrorCode.Unavailable, current.reason, [params.kind]);
    const run = new ProviderKindInstallRun();
    this.installs.set(params.kind, run);
    this.reads.delete(params.kind);
    const done = this.run(params.kind, installation, run);
    run.done = done;
    this.publish(params.kind, installation);
    return done;
  }

  public isInstalling(kind: string): boolean {
    return this.installs.has(kind);
  }

  public cancelInstall(params: ProviderKindParams): void {
    this.requireInstallation(params.kind);
    const run = this.installs.get(params.kind);
    if (run?.cancellable === true)
      run.controller.abort();
  }

  public async readPlanUsageAsync(params: PlanUsageParams): Promise<PlanUsage | null> {
    const adapter = this.registry.get(params.kind);
    const readAt = new Date().toISOString();
    const provider = await this.resolveProviderAsync(params.kind, params.providerId);
    if (provider?.enabled === false)
      return null;
    const read = await adapter.readPlanUsage?.(provider) ?? null;
    return Object.isNull(read) ? null : this.planUsage.record(params.kind, params.providerId, read.windows, readAt, read.plan);
  }

  private async run(kind: string, installation: IProviderKindInstallation, run: ProviderKindInstallRun): Promise<ProviderKindInstallation> {
    try {
      await installation.install((received, total) => {
        const before = ProviderKindsService.percent(run.received, run.total);
        run.received = received;
        run.total = total;
        if (ProviderKindsService.percent(received, total) !== before)
          this.publish(kind, installation);
      }, run.controller.signal, () => {
        run.cancellable = false;
        this.publish(kind, installation);
      });
      this.failures.delete(kind);
      this.versions.set(kind, new ProviderKindVersions((this.versions.get(kind) ?? ProviderKindVersions.unknown).installed, null));
    }
    catch (error) {
      if (!run.controller.signal.aborted) {
        const reason = (error instanceof Error ? error.message : String(error)) || Resources.installFailed;
        this.failures.set(kind, reason);
        throw new ServiceException(ErrorCode.Unavailable, reason, [kind]);
      }
    }
    finally {
      this.installs.delete(kind);
      this.publish(kind, installation);
      void this.readVersions(kind, installation, this.updateChecks.takeCheck());
    }
    return this.describe(kind, installation);
  }

  private installed(): readonly InstalledKind[] {
    return this.registry.all().flatMap(t => Object.isNullOrUndefined(t.installation) ? [] : [new InstalledKind(t.descriptor.id, t.installation)]);
  }

  private checkListed(): void {
    if (!this.listed)
      return;
    const checksLatest = this.updateChecks.takeCheck();
    for (const entry of this.installed())
      void this.readVersions(entry.kind, entry.installation, checksLatest);
  }

  private readVersions(kind: string, installation: IProviderKindInstallation, checksLatest: boolean): Promise<void> {
    const running = this.reads.get(kind);
    if (this.installs.has(kind))
      return Promise.resolve();
    if (!Object.isUndefined(running) && (running.checksLatest || !checksLatest))
      return running.done;
    const read = new ProviderKindsRead(checksLatest);
    this.reads.set(kind, read);
    read.done = installation.readVersions(checksLatest).then(versions => this.readEnded(kind, installation, read, versions),
      () => this.readEnded(kind, installation, read, this.versions.get(kind) ?? ProviderKindVersions.unknown));
    return read.done;
  }

  private readEnded(kind: string, installation: IProviderKindInstallation, read: ProviderKindsRead, found: ProviderKindVersions): void {
    if (this.reads.get(kind) !== read)
      return;
    this.reads.delete(kind);
    const known = this.versions.get(kind)?.latest ?? null;
    const versions = read.checksLatest || !Object.isNull(found.latest) ? found : new ProviderKindVersions(found.installed, known, found.notice);
    this.versions.set(kind, versions);
    if (!Object.isNull(versions.installed) && !Object.isNull(versions.latest) && Object.isNull(versions.update))
      this.failures.delete(kind);
    this.publish(kind, installation);
  }

  private describe(kind: string, installation: IProviderKindInstallation): ProviderKindInstallation {
    const run = this.installs.get(kind);
    const versions = this.versions.get(kind) ?? ProviderKindVersions.unknown;
    if (!Object.isUndefined(run))
      return new ProviderKindInstallation(kind, ProviderKindInstallState.Installing, null, run.received, run.total, versions.installed, null, run.cancellable);
    if (installation.isInstalled)
      return new ProviderKindInstallation(kind, ProviderKindInstallState.Installed, this.failures.get(kind) ?? null, 0, 0, versions.installed, versions.update, true,
        null, installation.foundPath ?? null, versions.notice);
    const unavailable = installation.unavailable;
    return Object.isNull(unavailable)
      ? new ProviderKindInstallation(kind, ProviderKindInstallState.NotInstalled, this.failures.get(kind) ?? installation.notInstalledReason ?? null)
      : new ProviderKindInstallation(kind, ProviderKindInstallState.Unavailable, unavailable, 0, 0, null, null, true, installation.missingTool);
  }

  private publish(kind: string, installation: IProviderKindInstallation): void {
    this.events.publish(new Event(EventName.ProviderKindInstallationChanged, this.describe(kind, installation).toJson()));
  }

  private requireInstallation(kind: string): IProviderKindInstallation {
    const adapter = this.registry.get(kind);
    if (Object.isNullOrUndefined(adapter.installation))
      throw new ServiceException(ErrorCode.Unavailable, Resources.formatInstallUnavailable(adapter.descriptor.displayName), [kind]);
    return adapter.installation;
  }

  private async resolveProviderAsync(kind: string, providerId: string | null): Promise<Provider | null> {
    if (Object.isNull(providerId))
      return null;
    const provider = await this.providers.findAsync(providerId);
    if (Object.isNull(provider))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotFound(providerId), [providerId]);
    if (provider.kind !== kind)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProviderMismatch(providerId, kind), [providerId, kind]);
    return provider;
  }

  private static percent(received: number, total: number): number {
    return total === 0 ? 0 : Math.floor(received * Resources.percentScale / total);
  }
}
