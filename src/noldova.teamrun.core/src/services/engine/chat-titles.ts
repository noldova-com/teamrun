/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { mkdirSync } from "node:fs";

import { AuthStatus, Event, EventName, RequestedSettings } from "@noldova/teamrun.protocol";

import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import { ConversationTitle } from "../../models/conversation-title.js";
import { SharedMcpValues } from "../../models/shared-mcp-values.js";
import { TitleModel } from "../../models/title-model.js";
import { TurnRequest } from "../../models/turn-request.js";
import { Resources } from "../../resources.js";
import { TitleTurn } from "./title-turn.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";

export class ChatTitles {
  private readonly asks: Map<string, AbortController> = new Map();
  private readonly firstTurns: Set<string> = new Set();
  private readonly running: Set<Promise<void>> = new Set();
  private readonly conversations: IConversationsService;
  private readonly providers: IProvidersService;
  private readonly registry: ProviderKindRegistry;
  private readonly events: IEventSink;
  private readonly folder: string;
  private readonly readChoice: () => string;
  private readonly log: ILog | null;
  private readonly timeout: number;

  public constructor(
    conversations: IConversationsService,
    providers: IProvidersService,
    registry: ProviderKindRegistry,
    events: IEventSink,
    folder: string,
    readChoice: () => string,
    log: ILog | null = null,
    timeout: number = Resources.titleAskTimeout) {
    this.conversations = conversations;
    this.providers = providers;
    this.registry = registry;
    this.events = events;
    this.folder = folder;
    this.readChoice = readChoice;
    this.log = log;
    this.timeout = timeout;
  }

  public async beginAsync(chatId: string, opening: string, chatModel: TitleModel | null): Promise<void> {
    this.firstTurns.add(chatId);
    const ask = new AbortController();
    this.asks.set(chatId, ask);
    const models = await this.modelsOfAsync(chatModel);
    if (models.length === 0 || ask.signal.aborted) {
      if (this.asks.get(chatId) === ask)
        this.asks.delete(chatId);
      return;
    }
    const run: Promise<void> = this.askAsync(chatId, opening, models, ask.signal)
      .catch(() => this.log?.write(Resources.titleNotKept))
      .finally(() => {
        if (this.asks.get(chatId) === ask)
          this.asks.delete(chatId);
        this.running.delete(run);
      });
    this.running.add(run);
  }

  public async offerAsync(chatId: string, title: string): Promise<void> {
    const text = ConversationTitle.ofAnswer(title);
    if (!this.firstTurns.has(chatId) || Object.isNull(text))
      return;
    this.firstTurns.delete(chatId);
    this.asks.get(chatId)?.abort();
    this.asks.delete(chatId);
    await this.applyAsync(chatId, text);
  }

  public end(chatId: string): void {
    this.firstTurns.delete(chatId);
  }

  public forget(chatIds: readonly string[]): void {
    for (const chatId of chatIds) {
      this.firstTurns.delete(chatId);
      this.asks.get(chatId)?.abort();
    }
  }

  public async shutdown(): Promise<void> {
    for (const ask of this.asks.values())
      ask.abort();
    await Promise.all(this.running);
  }

  private async modelsOfAsync(chatModel: TitleModel | null)
    : Promise<readonly (readonly [TitleModel, (request: TurnRequest, signal: AbortSignal) => Promise<string | null>])[]> {
    const chosen = await this.chosenOrNoneAsync();
    const models = Object.isNull(chosen) ? [] : [chosen];
    if (!Object.isNull(chatModel) && !models.some(t => t.isSameAs(chatModel)))
      models.push(chatModel);
    return models.flatMap(t => {
      const adapter = this.registry.has(t.kind) ? this.registry.get(t.kind) : null;
      if (Object.isNull(adapter) || Object.isUndefined(adapter.askIsolated))
        return [];
      return [[t, (request: TurnRequest, signal: AbortSignal): Promise<string | null> => TitleTurn.ask(adapter, request, signal)] as const];
    });
  }

  private async chosenOrNoneAsync(): Promise<TitleModel | null> {
    try {
      return await this.chosenModelAsync();
    }
    catch {
      this.log?.write(Resources.titleChoiceNotRead);
      return null;
    }
  }

  private async chosenModelAsync(): Promise<TitleModel | null> {
    const choice = this.readChoice();
    const separator = choice.indexOf(Resources.titleModelSeparator);
    if (separator <= 0 || separator === choice.length - 1)
      return null;
    const provider = await this.providers.findAsync(choice.slice(0, separator));
    return Object.isNull(provider) || !provider.enabled || provider.authStatus === AuthStatus.LoggedOut ? null
      : new TitleModel(provider, provider.kind, choice.slice(separator + 1));
  }

  private async askAsync(chatId: string, opening: string, models: readonly (readonly [TitleModel, (request: TurnRequest, signal: AbortSignal) => Promise<string | null>])[],
    signal: AbortSignal): Promise<void> {
    for (const [model, ask] of models) {
      const title = await this.askModel(model, ask, opening, signal);
      if (signal.aborted)
        return;
      if (!Object.isNull(title)) {
        this.firstTurns.delete(chatId);
        await this.applyAsync(chatId, title);
        return;
      }
    }
  }

  private async askModel(model: TitleModel, ask: (request: TurnRequest, signal: AbortSignal) => Promise<string | null>, opening: string,
    signal: AbortSignal): Promise<string | null> {
    const timed = AbortSignal.any([signal, AbortSignal.timeout(this.timeout)]);
    const stopped = Promise.withResolvers<null>();
    timed.addEventListener(Resources.abortEvent, () => stopped.resolve(null), { once: true });
    try {
      mkdirSync(this.folder, { recursive: true });
      const request = new TurnRequest(model.provider, this.folder, Resources.formatTitlePrompt(opening.slice(0, Resources.titleOpeningLength)),
        new RequestedSettings(model.kind, model.model, null, null, null), null, [], null, null, {}, false, null, [], null, undefined, SharedMcpValues.none, null, true);
      const answer = await Promise.race([ask(request, timed), stopped.promise]);
      return Object.isNull(answer) ? null : ConversationTitle.ofAnswer(answer);
    }
    catch {
      this.log?.write(Resources.formatTitleAskFailed(model.kind));
      return null;
    }
  }

  private async applyAsync(chatId: string, title: string): Promise<void> {
    if (!Object.isNull(await this.conversations.giveTitleAsync(chatId, title)))
      this.events.publish(new Event(EventName.StateInvalidated, null));
  }
}
