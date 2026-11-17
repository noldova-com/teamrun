/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { type ILog, type IProviderKindInstallation, type ITimer, type ITurnListener, NodeTimer, PlanReading, Resources as CoreResources, SignInCheck }
  from "@noldova/teamrun.core";
import { AuthStatus, PlanWindow, PlanWindowName, type Provider, ProviderModelList } from "@noldova/teamrun.protocol";

import { AcpRequestException } from "../../exceptions/acp-request.exception.js";
import { ModelListException } from "../../exceptions/model-list.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { AcpAdapter } from "../acp/acp-adapter.js";
import type { AcpClient } from "../acp/acp-client.js";
import { FailureDescriber } from "../failure-describer.js";
import { UsageValues } from "../usage-values.js";
import { CopilotAgent } from "./copilot-agent.js";
import { CopilotModelLister } from "./copilot-model-lister.js";
import { CopilotQuotaReader } from "./copilot-quota.reader.js";

export class CopilotAdapter extends AcpAdapter {
  private static readonly timeouts: readonly string[] = [Resources.copilotConnectMethod, Resources.copilotAuthStatusMethod,
    Resources.copilotSessionCreateMethod, Resources.copilotSessionModelListMethod, Resources.copilotQuotaMethod]
    .map(t => Resources.formatAcpTimeout(t));

  public readonly installation?: IProviderKindInstallation;
  private readonly lister: CopilotModelLister;
  private readonly log: ILog | null;
  private readonly listings: Map<string, ProviderModelList> = new Map();
  private readonly running: Map<string, Promise<ProviderModelList>> = new Map();
  private readonly planReads: Set<Promise<void>> = new Set();
  private readonly planned: Set<string> = new Set();
  private readonly assumed: Set<string> = new Set();

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, workDirectory: string, clientInfo: AppServerClientInfo,
    starter: IProcessStarter, timings: ProviderTimings, timer: ITimer = new NodeTimer(), log: ILog | null = null,
    locate: () => ProcessCommand | null = CommandSource.none, installation: IProviderKindInstallation | null = null, idleTimer: ITimer = new NodeTimer()) {
    const agent = new CopilotAgent(command, environment, workDirectory, locate);
    super(agent, clientInfo, starter, timings, timer, undefined, undefined, undefined, idleTimer);
    this.lister = new CopilotModelLister(agent, starter, timings, timer, log);
    this.log = log;
    if (!Object.isNull(installation))
      this.installation = installation;
  }

  public override async listModels(provider: Provider | null, refresh: boolean = false): Promise<ProviderModelList> {
    const install = provider?.profileDir ?? String.empty;
    if (refresh)
      this.listings.delete(install);
    const kept = this.listings.get(install);
    if (!Object.isUndefined(kept))
      return kept;
    const running = this.running.get(install);
    if (!refresh && !Object.isUndefined(running))
      return await running;

    const listing: Promise<ProviderModelList> = this.list(provider, refresh, t => this.keep(install, listing, t));
    this.running.set(install, listing);
    try {
      return await listing;
    }
    finally {
      if (this.running.get(install) === listing)
        this.running.delete(install);
    }
  }

  private async list(provider: Provider | null, refresh: boolean, keep: (listed: ProviderModelList) => void): Promise<ProviderModelList> {
    const shutdowns = this.lister.shutdowns;
    let listed: ProviderModelList;
    try {
      listed = this.withModes(await this.lister.list(provider, refresh));
    }
    catch (error) {
      if (shutdowns !== this.lister.shutdowns)
        throw error;
      return await this.listOverAcp(provider, CopilotAdapter.describe(error), false);
    }
    if (listed.signedIn === true && listed.models.length === 0 && Object.isNull(listed.planName))
      return await this.listOverAcp(provider, Resources.copilotListingEmpty, true);
    if (listed.signedIn === true)
      keep(listed);
    return listed;
  }

  private keep(install: string, listing: Promise<ProviderModelList>, listed: ProviderModelList): void {
    if (this.running.get(install) === listing)
      this.listings.set(install, listed);
  }

  private async listOverAcp(provider: Provider | null, reason: string, empty: boolean): Promise<ProviderModelList> {
    const providerId = provider?.id ?? null;
    let listed: ProviderModelList;
    try {
      listed = await super.listModels(provider);
    }
    catch (error) {
      this.log?.write(Resources.formatCopilotListingsFailed(providerId, reason, CoreResources.formatFailureKind(error)));
      throw error;
    }
    if (listed.signedIn !== true || listed.models.length > 0) {
      this.log?.write(Resources.formatCopilotListingFailed(providerId, reason));
      return listed;
    }
    if (empty) {
      this.log?.write(Resources.formatCopilotListingsEmpty(providerId));
      return this.withModes(new ProviderModelList([], true, true));
    }
    this.log?.write(Resources.formatCopilotListingFailedAndAcpListsNone(providerId, reason));
    throw new ModelListException(Resources.formatCopilotModelsNotListed(reason));
  }

  protected override withModes(list: ProviderModelList): ProviderModelList {
    const moded = super.withModes(list);
    return new ProviderModelList(moded.models, moded.signedIn, moded.empty, moded.planName, moded.awaitsTurn, moded.modes, moded.defaultMode, true);
  }

  protected override checkUnavailableModel(provider: Provider | null, model: string): Promise<boolean> | null {
    const install = provider?.profileDir ?? String.empty;
    const kept = this.listings.get(install);
    if (Object.isUndefined(kept) || kept.models.some(t => t.id === model))
      return null;
    return this.listModels(provider, true).then(t => this.listings.get(install) === t && !t.models.some(m => m.id === model), () => false);
  }

  public override async checkSignIn(provider: Provider): Promise<SignInCheck> {
    const check = await super.checkSignIn(provider);
    if (check.authStatus !== AuthStatus.LoggedIn)
      return check;
    return new SignInCheck(check.authStatus, await this.lister.readAccount(provider).catch(() => null), check.harnessVersion, check.error);
  }

  public override async readPlanUsage(provider: Provider | null): Promise<PlanReading | null> {
    const answer = await this.readQuota(provider, false);
    const windows = CopilotQuotaReader.read(answer);
    const plan = CopilotQuotaReader.readPlan(answer);
    return Object.isNull(windows) && Object.isNull(plan) ? null : new PlanReading(windows ?? [], plan);
  }

  public override async shutdown(): Promise<void> {
    await Promise.all(this.planReads);
    await Promise.all([super.shutdown(), this.lister.shutdown()]);
  }

  protected override async reportPlanUsage(_client: AcpClient, provider: Provider | null, listener: ITurnListener, reply: string): Promise<void> {
    const refused = CopilotAdapter.isRefusalReply(reply);
    if (refused || this.isRead(provider))
      await this.startPlanReadAsync(provider, listener, refused);
  }

  protected override async reportPlanAfterFailure(_client: AcpClient, provider: Provider | null, listener: ITurnListener, error: unknown): Promise<void> {
    const refused = CopilotAdapter.isQuotaRefusal(error);
    if (refused || this.isRead(provider))
      await this.startPlanReadAsync(provider, listener, refused);
  }

  private isRead(provider: Provider | null): boolean {
    const key = CopilotAdapter.planKey(provider);
    return this.planned.has(key) || this.assumed.has(key);
  }

  private async startPlanReadAsync(provider: Provider | null, listener: ITurnListener, refused: boolean): Promise<void> {
    const key = CopilotAdapter.planKey(provider);
    const readAt = new Date().toISOString();
    if (refused) {
      this.assumed.add(key);
      await AcpAdapter.reportPlanAsync(listener, [new PlanWindow(PlanWindowName.Quota, Resources.percentScale, null)], readAt);
    }
    const read: Promise<void> = this.readQuota(provider, true).then(async answer => {
      try {
        const windows = CopilotQuotaReader.read(answer);
        const known = windows ?? [];
        const assumed = refused && !known.some(t => (t.usedPercent ?? 0) >= Resources.percentScale);
        const shown = assumed ? [...known, new PlanWindow(PlanWindowName.Quota, Resources.percentScale, null)]
          : Object.isNull(windows) && this.assumed.has(key) ? known : windows;
        if (assumed)
          this.assumed.add(key);
        else
          this.assumed.delete(key);
        await AcpAdapter.reportPlanAsync(listener, shown, readAt);
      }
      finally {
        this.planReads.delete(read);
      }
    }).catch((error: unknown) => {
      this.log?.write(FailureDescriber.describe(error));
    });
    this.planReads.add(read);
  }

  private async readQuota(provider: Provider | null, refresh: boolean): Promise<JsonValue | null> {
    const answer = await this.lister.readQuota(provider, refresh).catch(() => null);
    if (Object.isNull(CopilotQuotaReader.read(answer)))
      this.planned.delete(CopilotAdapter.planKey(provider));
    else
      this.planned.add(CopilotAdapter.planKey(provider));
    return answer;
  }

  private static isQuotaRefusal(error: unknown): boolean {
    const data = error instanceof AcpRequestException ? error.data : null;
    const texts = [String(error), ...Resources.copilotRefusalDataFields.map(t => UsageValues.fieldOf(data, t))];
    return texts.some(t => typeof t === "string" && Resources.copilotQuotaRefusal.test(t));
  }

  private static isRefusalReply(reply: string): boolean {
    const message = Resources.copilotRefusalReply.exec(reply.trim())?.[1];
    return !Object.isUndefined(message) && Resources.copilotQuotaRefusal.test(message);
  }

  private static planKey(provider: Provider | null): string {
    return provider?.id ?? String.empty;
  }

  private static describe(error: unknown): string {
    return error instanceof Error && CopilotAdapter.timeouts.includes(error.message) ? Resources.copilotListingTimedOut : CoreResources.formatFailureKind(error);
  }
}
