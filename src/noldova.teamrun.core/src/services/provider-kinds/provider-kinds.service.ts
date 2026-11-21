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
import type { IPlanUsageService } from "../../interfaces/i-plan-usage.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { IProviderKindInstallation } from "../../interfaces/i-provider-kind-installation.js";
import { ProviderKindVersions } from "../../models/provider-kind-versions.js";
import type { IProviderKindsService } from "../../interfaces/i-provider-kinds.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { ProviderKindInstallRun } from "../../models/provider-kind-install-run.js";
import { Resources } from "../../resources.js";
import { PlanUsageService } from "./plan-usage.service.js";
import type { ProviderKindRegistry } from "./provider-kind-registry.js";

export class ProviderKindsService implements IProviderKindsService {
  private readonly registry: ProviderKindRegistry;
  private readonly providers: IProvidersService;
  private readonly events: IEventSink;
  private readonly planUsage: IPlanUsageService;
  private readonly teammates: ITeammatesService | null;
  private readonly installs: Map<string, ProviderKindInstallRun> = new Map();
  private readonly failures: Map<string, string> = new Map();
  private readonly versions: Map<string, ProviderKindVersions> = new Map();
  private readonly reads: Map<string, object> = new Map();

  public constructor(registry: ProviderKindRegistry, providers: IProvidersService, events: IEventSink,
    planUsage: IPlanUsageService = new PlanUsageService(events), teammates: ITeammatesService | null = null) {
    this.registry = registry;
    this.providers = providers;
    this.events = events;
    this.planUsage = planUsage;
    this.teammates = teammates;
  }

  public list(): readonly ProviderKind[] {
    return this.registry.all().map(t => t.descriptor.withNamesChats(!Object.isUndefined(t.askIsolated)));
  }

  public async listAsync(): Promise<readonly ProviderKind[]> {
    await Promise.all(this.registry.all().map(t => t.refreshDescriptorAsync?.().catch(() => undefined)));
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
    const installed = this.registry.all().flatMap(t => Object.isNullOrUndefined(t.installation) ? [] : [[t.descriptor.id, t.installation] as const]);
    for (const [kind, installation] of installed)
      this.readVersions(kind, installation);
    return Promise.resolve(installed.map(([kind, installation]) => this.describe(kind, installation)));
  }

  public listTools(): Promise<readonly ProviderTool[]> {
    return Promise.all(this.registry.tools().map(t => t.check()));
  }

  public install(params: ProviderKindParams): Promise<ProviderKindInstallation> {
    const installation = this.requireInstallation(params.kind);
    const running = this.installs.get(params.kind);
    if (!Object.isUndefined(running))
      return running.done!;
    const current = this.describe(params.kind, installation);
    if (current.state === ProviderKindInstallState.Installed && Object.isNull(current.update))
      return Promise.resolve(current);
    if (current.state === ProviderKindInstallState.Unavailable)
      throw new ServiceException(ErrorCode.Unavailable, current.reason!, [params.kind]);
    const run = new ProviderKindInstallRun();
    this.installs.set(params.kind, run);
    this.reads.delete(params.kind);
    run.done = this.run(params.kind, installation, run);
    this.publish(params.kind, installation);
    return run.done;
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
      this.readVersions(kind, installation);
    }
    return this.describe(kind, installation);
  }

  private readVersions(kind: string, installation: IProviderKindInstallation): void {
    if (this.installs.has(kind) || this.reads.has(kind))
      return;
    const read = {};
    this.reads.set(kind, read);
    void installation.readVersions().then(versions => this.readEnded(kind, installation, read, versions),
      () => this.readEnded(kind, installation, read, this.versions.get(kind) ?? ProviderKindVersions.unknown));
  }

  private readEnded(kind: string, installation: IProviderKindInstallation, read: object, versions: ProviderKindVersions): void {
    if (this.reads.get(kind) !== read)
      return;
    this.reads.delete(kind);
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
        null, installation.foundPath ?? null);
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
