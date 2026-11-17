/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { mkdirSync } from "node:fs";
import { SqlQuery } from "@noldova/context.data.sql";
import { type Provider, RequestedSettings } from "@noldova/teamrun.protocol";

import type { ILog } from "../../interfaces/i-log.js";
import type { ITimer } from "../../interfaces/i-timer.js";
import { SharedMcpValues } from "../../models/shared-mcp-values.js";
import { TurnRequest } from "../../models/turn-request.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";
import { ChatSummary } from "./chat-summary.js";
import { SummaryTurn } from "./summary-turn.js";

export class HandoverSummaries {
  private readonly context: DatabaseContext;
  private readonly registry: ProviderKindRegistry;
  private readonly folder: string;
  private readonly timer: ITimer;
  private readonly log: ILog | null;
  private readonly failed: Set<string> = new Set<string>();

  public constructor(context: DatabaseContext, registry: ProviderKindRegistry, folder: string, timer: ITimer, log: ILog | null) {
    this.context = context;
    this.registry = registry;
    this.folder = folder;
    this.timer = timer;
    this.log = log;
  }

  public async findAsync(chatId: string, teammateId: string, through: number): Promise<ChatSummary | null> {
    const [row] = await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectHandoverSummary, [chatId, teammateId, through]));
    return Object.isUndefined(row) ? null : new ChatSummary(row.readString(Resources.textColumn), this.nameOf(row.readNullableString(Resources.kindColumn)), false);
  }

  public async writeAsync(chatId: string, teammateId: string, through: number, provider: Provider, requested: RequestedSettings, prompt: string,
    signal: AbortSignal): Promise<ChatSummary | null> {
    const point = [chatId, teammateId, through].join(Resources.lineSeparator);
    if (this.failed.has(point))
      return null;
    const timed = new AbortController();
    void this.timer.delayAsync(Resources.ownSummaryTimeout, timed.signal).then(() => timed.abort(), () => undefined);
    try {
      mkdirSync(this.folder, { recursive: true });
      const request = new TurnRequest(provider, this.folder, prompt, new RequestedSettings(requested.kind, requested.model, requested.effort), null, [], null, null,
        {}, false, null, [], null, undefined, SharedMcpValues.none, null, true);
      const text = await SummaryTurn.ask(this.registry.get(requested.kind), request, AbortSignal.any([signal, timed.signal]));
      if (Object.isNull(text))
        return null;
      await this.context.database.connection.executeAsync(new SqlQuery(Resources.upsertHandoverSummary, [chatId, teammateId, through, text, requested.kind]));
      return new ChatSummary(text, this.nameOf(requested.kind), false);
    }
    catch (error) {
      this.failed.add(point);
      this.log?.write(Resources.formatOwnSummaryFailed(provider.id, Resources.formatFailureKind(error)));
      return null;
    }
    finally {
      timed.abort();
    }
  }

  private nameOf(kind: string | null): string | null {
    return Object.isNull(kind) || !this.registry.has(kind) ? null : this.registry.get(kind).descriptor.displayName;
  }
}
