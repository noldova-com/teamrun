/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import {
  ErrorCode,
  Event,
  EventName,
  PanelName,
  PanelOutcome,
  PanelRequestedPayload,
  Resources as ProtocolResources,
  type PanelAnsweredParams,
  type WindowFocusedParams,
  type WindowIdParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IWindowsService } from "../../interfaces/i-windows.service.js";
import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";

export class WindowsService implements IWindowsService {
  private readonly events: IEventSink;
  private readonly conversations: IConversationsService;
  private readonly answerWait: number;
  private readonly shown: Map<string, string | null> = new Map();
  private readonly silent: Set<string> = new Set();
  private readonly waits: Map<string, { readonly windowId: string; readonly settle: (outcome: PanelOutcome | null) => void }> = new Map();
  private readonly shownListeners: Set<(conversationId: string) => void> = new Set();

  public constructor(events: IEventSink, conversations: IConversationsService, answerWait: number = Resources.panelAnswerWait) {
    this.events = events;
    this.conversations = conversations;
    this.answerWait = answerWait;
  }

  public focus(params: WindowFocusedParams): void {
    this.silent.delete(params.windowId);
    if (params.focused)
      this.shown.delete(params.windowId);
    if (params.focused || this.shown.has(params.windowId))
      this.shown.set(params.windowId, params.shownConversationId);
    else
      this.putBehind(params.windowId, params.shownConversationId);
    if (!Object.isNull(params.shownConversationId))
      for (const listener of [...this.shownListeners])
        listener(params.shownConversationId);
  }

  public close(params: WindowIdParams): void {
    this.shown.delete(params.windowId);
    this.silent.delete(params.windowId);
    for (const wait of [...this.waits.values()].filter(t => t.windowId === params.windowId))
      wait.settle(null);
  }

  public answer(params: PanelAnsweredParams): void {
    this.silent.delete(params.windowId);
    this.waits.get(params.requestId)?.settle(params.outcome);
  }

  public reload(params: WindowIdParams): void {
    if (!this.shown.has(params.windowId))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatWindowNotFound(params.windowId), [params.windowId]);
    this.events.publish(new Event(EventName.WindowReloadRequested, params.toJson()));
  }

  public isShown(conversationId: string): boolean {
    return [...this.shown.values()].includes(conversationId);
  }

  public onShown(listener: (conversationId: string) => void): () => void {
    this.shownListeners.add(listener);
    return () => void this.shownListeners.delete(listener);
  }

  public async requestAsync(panel: PanelName, conversationId: string | null, open: boolean, callerConversationId: string | null,
    signal?: AbortSignal): Promise<string> {
    const withdrawn = signal ?? new AbortController().signal;
    if ([PanelName.Chat, PanelName.Page].includes(panel) === Object.isNull(conversationId))
      throw new ArgumentException(ProtocolResources.panelConversationMismatch, ProtocolResources.chatIdField);
    if (!Object.isNull(conversationId) && Object.isNull(await this.conversations.findAsync(conversationId)))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(conversationId), [conversationId]);
    for (let windowId = this.choose(callerConversationId); !Object.isNull(windowId); windowId = this.choose(callerConversationId)) {
      const outcome = await this.askAsync(new PanelRequestedPayload(Guid.createVersion7().toString(), windowId, panel, conversationId, open), withdrawn);
      if (outcome === PanelOutcome.Done)
        return windowId;
      if (outcome === PanelOutcome.Refused)
        throw new ServiceException(ErrorCode.Conflict, Resources.panelRefused);
      if (outcome === PanelOutcome.Failed)
        throw new ServiceException(ErrorCode.Unavailable, Resources.panelFailed);
    }
    throw new ServiceException(ErrorCode.Unavailable, this.silent.size > 0 ? Resources.windowDidNotAnswer : Resources.noWindowOpen);
  }

  private choose(callerConversationId: string | null): string | null {
    const windows = [...this.shown].filter(([windowId]) => !this.silent.has(windowId)).reverse();
    return windows.find(([, shown]) => !Object.isNull(callerConversationId) && shown === callerConversationId)?.[0] ?? windows[0]?.[0] ?? null;
  }

  private putBehind(windowId: string, shownConversationId: string | null): void {
    const others = [...this.shown];
    this.shown.clear();
    this.shown.set(windowId, shownConversationId);
    for (const [other, shown] of others)
      this.shown.set(other, shown);
  }

  private async askAsync(payload: PanelRequestedPayload, signal: AbortSignal): Promise<PanelOutcome | null> {
    signal.throwIfAborted();
    const answered = Promise.withResolvers<PanelOutcome | null>();
    const timer = setTimeout(() => {
      this.silent.add(payload.windowId);
      answered.reject(new ServiceException(ErrorCode.Unavailable, Resources.windowDidNotAnswer));
    }, this.answerWait);
    const abort = (): void => answered.reject(signal.reason);
    this.waits.set(payload.requestId, { windowId: payload.windowId, settle: t => answered.resolve(t) });
    signal.addEventListener(Resources.abortEvent, abort, { once: true });
    try {
      this.events.publish(new Event(EventName.PanelRequested, payload.toJson()));
      return await answered.promise;
    }
    finally {
      clearTimeout(timer);
      this.waits.delete(payload.requestId);
      signal.removeEventListener(Resources.abortEvent, abort);
    }
  }
}
