/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ComputerUseGrant, ErrorCode, type ComputerUseGrantIdParams } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import type { IAppDescriptions } from "../../interfaces/i-app-descriptions.js";
import type { IComputerUseGrantsService } from "../../interfaces/i-computer-use-grants.service.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IRememberedAppGrants } from "../../interfaces/i-remembered-app-grants.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import type { ITimer } from "../../interfaces/i-timer.js";
import type { AppLook } from "../../models/app-look.js";
import type { ComputerUseGrantTimings } from "../../models/computer-use-grant-timings.js";
import type { RememberedAppGrant } from "../../models/remembered-app-grant.js";
import { Resources } from "../../resources.js";

export class ComputerUseGrantsService implements IComputerUseGrantsService {
  private readonly grants: IRememberedAppGrants;
  private readonly conversations: IConversationsService;
  private readonly teammates: ITeammatesService;
  private readonly descriptions: IAppDescriptions | null;
  private readonly timings: ComputerUseGrantTimings;
  private readonly timer: ITimer;
  private readonly described: Map<string, { readonly look: AppLook; readonly describedAt: number }> = new Map();
  private readonly describing: Map<string, { readonly signal: AbortSignal; readonly done: Promise<AppLook | null> }> = new Map();

  public constructor(grants: IRememberedAppGrants, conversations: IConversationsService, teammates: ITeammatesService,
    descriptions: IAppDescriptions | null, timings: ComputerUseGrantTimings, timer: ITimer) {
    this.grants = grants;
    this.conversations = conversations;
    this.teammates = teammates;
    this.descriptions = descriptions;
    this.timings = timings;
    this.timer = timer;
  }

  public async listAsync(signal: AbortSignal = new AbortController().signal): Promise<readonly ComputerUseGrant[]> {
    signal.throwIfAborted();
    const grants = this.grants.list().toSorted((a, b) => b.rememberedAt.getTime() - a.rememberedAt.getTime());
    const apps = [...new Set(grants.map(t => t.app).filter((t): t is string => !Object.isNull(t)))];
    const now = this.timer.now();
    await this.describeEachAsync(apps.filter(t => !this.isFresh(t, now)), signal);
    signal.throwIfAborted();

    const listed: ComputerUseGrant[] = [];
    for (const grant of grants)
      listed.push(await this.toGrantAsync(grant, Object.isNull(grant.app) ? null : this.described.get(grant.app)?.look ?? null));
    return listed;
  }

  public revoke(params: ComputerUseGrantIdParams): void {
    const grant = this.grants.list().find(t => t.id === params.grantId);
    if (Object.isUndefined(grant) || !this.grants.revoke(params.grantId))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatComputerUseGrantNotFound(params.grantId), [params.grantId]);
    this.forgetLook(grant);
  }

  public forget(chatIds: readonly string[]): void {
    const gone = new Set(chatIds);
    for (const grant of this.grants.list().filter(t => gone.has(ComputerUseGrantsService.chatOf(t.scope)))) {
      this.grants.revoke(grant.id);
      this.forgetLook(grant);
    }
  }

  private static chatOf(scope: string): string {
    const separator = scope.indexOf(Resources.toolScopeSeparator);
    return separator < 0 ? scope : scope.slice(0, separator);
  }

  private async describeEachAsync(apps: readonly string[], signal: AbortSignal): Promise<void> {
    const descriptions = this.descriptions;
    if (Object.isNull(descriptions) || apps.length === 0)
      return;
    const deadline = new AbortController();
    const described = AbortSignal.any([signal, deadline.signal]);
    const waited = new AbortController();
    const ended = this.timer.delayAsync(this.timings.describeWait, AbortSignal.any([signal, waited.signal])).then(() => deadline.abort(), () => undefined);
    try {
      await Promise.race([Promise.all(apps.map(async t => await this.describeAsync(descriptions, t, described))), ended]);
    }
    finally {
      waited.abort();
    }
  }

  private isFresh(app: string, now: number): boolean {
    const entry = this.described.get(app);
    return !Object.isUndefined(entry) && now - entry.describedAt < this.timings.lifetime;
  }

  private async describeAsync(descriptions: IAppDescriptions, app: string, signal: AbortSignal): Promise<void> {
    const shared = this.describing.get(app);
    if (!Object.isUndefined(shared) && !shared.signal.aborted) {
      await shared.done;
      return;
    }
    const describing = { signal, done: descriptions.describeAsync(app, signal).catch(() => null) };
    this.describing.set(app, describing);
    const look = await describing.done;
    if (this.describing.get(app) !== describing)
      return;
    this.describing.delete(app);
    if (!Object.isNull(look) && !signal.aborted)
      this.described.set(app, { look, describedAt: this.timer.now() });
  }

  private forgetLook(grant: RememberedAppGrant): void {
    if (Object.isNull(grant.app))
      return;
    this.described.delete(grant.app);
    this.describing.delete(grant.app);
  }

  private async toGrantAsync(grant: RememberedAppGrant, look: AppLook | null): Promise<ComputerUseGrant> {
    const chatId = ComputerUseGrantsService.chatOf(grant.scope);
    const scoped = chatId === grant.scope ? Resources.defaultToolScope : grant.scope.slice(chatId.length + Resources.toolScopeSeparator.length);
    const teammate = scoped === Resources.defaultToolScope ? null : await this.teammates.findAsync(scoped);

    return new ComputerUseGrant(grant.id, chatId, (await this.conversations.findAsync(chatId))?.title ?? null, teammate?.name ?? null, grant.app,
      look?.name ?? null, look?.icon ?? null, grant.rememberedAt.toISOString());
  }
}
