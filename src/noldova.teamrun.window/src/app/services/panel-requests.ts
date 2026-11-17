/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";
import {
  EventName,
  MethodName,
  PanelAnsweredParams,
  PanelName,
  PanelOutcome,
  PanelRequestedPayload,
  WindowFocusedParams,
  WindowIdParams
} from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { ChatStoreService } from "./chat-store.service";
import { CommandTargetsService } from "./command-targets.service";
import { ConversationActions } from "./conversation-actions";

export class PanelRequests {
  private static readonly pages: ReadonlyMap<PanelName, readonly [string, string, string]> = new Map([
    [PanelName.Teammates, [Resources.teammatesDocumentName, Resources.teammatesDocumentInstance, Resources.teammatesTitle]],
    [PanelName.Providers, [Resources.providersDocumentName, Resources.providersDocumentInstance, Resources.providersTitle]]
  ]);
  private static readonly views: ReadonlyMap<PanelName, string> = new Map([
    [PanelName.Projects, Resources.projectsViewName],
    [PanelName.Activity, Resources.activityViewName],
    [PanelName.Changes, Resources.changesViewName],
    [PanelName.Plan, Resources.planViewName],
    [PanelName.SubAgents, Resources.subAgentsViewName],
    [PanelName.BackgroundTasks, Resources.backgroundTasksViewName]
  ]);
  private static readonly requests: WeakMap<IWindowPartContext, PanelRequests> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly store: ChatStoreService;
  private readonly windowId: string;
  private readonly subscriptions: readonly (() => void)[];
  private typedAt: number = Number.NEGATIVE_INFINITY;

  private constructor(context: IWindowPartContext, store: ChatStoreService) {
    this.context = context;
    this.store = store;
    this.windowId = store.windowId;
    const focus = (): void => this.report(store.shownConversationId(), true);
    const typed = (): void => {
      if (document.hasFocus())
        this.typedAt = Date.now();
    };
    globalThis.addEventListener("focus", focus);
    document.addEventListener("keydown", typed, true);
    this.subscriptions = [
      () => globalThis.removeEventListener("focus", focus),
      () => document.removeEventListener("keydown", typed, true),
      store.onShownConversationChanged(t => this.report(t, document.hasFocus())),
      context.onEvent(Resources.formatQualifiedName(EventName.PanelRequested), t => this.act(PanelRequestedPayload.fromJson(t)))
    ];
    this.report(store.shownConversationId(), document.hasFocus());
  }

  public static register(context: IWindowPartContext, store: ChatStoreService): void {
    PanelRequests.requests.set(context, new PanelRequests(context, store));
  }

  public static reportAgain(context: IWindowPartContext): void {
    const requests = PanelRequests.requests.get(context);
    if (!Object.isUndefined(requests))
      requests.report(requests.store.shownConversationId(), document.hasFocus());
  }

  public static release(context: IWindowPartContext): void {
    PanelRequests.requests.get(context)?.dispose();
    PanelRequests.requests.delete(context);
  }

  private dispose(): void {
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
    this.send(MethodName.WindowClosed, new WindowIdParams(this.windowId).toJson());
  }

  private report(shownConversationId: string | null, focused: boolean): void {
    this.send(MethodName.WindowFocused, new WindowFocusedParams(this.windowId, shownConversationId, focused).toJson());
  }

  private act(payload: PanelRequestedPayload): void {
    if (payload.windowId !== this.windowId)
      return;
    if (payload.panel === PanelName.Page && !Object.isNull(payload.conversationId)) {
      const conversationId = payload.conversationId;
      void this.showChatPageAsync(conversationId, payload.open).catch((error: unknown) => {
        this.context.log(Resources.formatChatPageNotChanged(conversationId, error instanceof Error ? error.name : typeof error));
        return PanelOutcome.Failed;
      }).then(t => this.answer(payload, t));
      return;
    }
    let outcome = PanelOutcome.Failed;
    try {
      outcome = this.carryOut(payload);
    }
    finally {
      this.answer(payload, outcome);
    }
  }

  private answer(payload: PanelRequestedPayload, outcome: PanelOutcome): void {
    this.send(MethodName.PanelAnswered, new PanelAnsweredParams(payload.requestId, this.windowId, outcome).toJson());
  }

  private isTyping(): boolean {
    return Date.now() - this.typedAt < Resources.typingSettleTime || CommandTargetsService.of(this.context).isTypingInAnyChat();
  }

  private carryOut(payload: PanelRequestedPayload): PanelOutcome {
    const page = PanelRequests.pages.get(payload.panel);
    const view = PanelRequests.views.get(payload.panel);
    if (this.isTyping())
      return PanelOutcome.Refused;
    if (!Object.isUndefined(view) && payload.open)
      this.context.showView(view);
    else if (!Object.isUndefined(view))
      this.context.hideViewDock(view);
    else if (!Object.isUndefined(page) && payload.open)
      this.context.openDocument(...page);
    else if (!Object.isUndefined(page))
      this.context.closeDocument(page[0], page[1]);
    else if (payload.open)
      this.openConversation(payload.conversationId!);
    else
      this.context.closeDocument(Resources.conversationDocumentName, payload.conversationId!);
    return PanelOutcome.Done;
  }

  private async showChatPageAsync(conversationId: string, open: boolean): Promise<PanelOutcome> {
    if (this.isTyping())
      return PanelOutcome.Refused;
    if (!open) {
      this.context.closeDocument(Resources.browserPageDocumentName, conversationId);
      return PanelOutcome.Done;
    }
    await this.store.showChatPageAsync(conversationId);
    return PanelOutcome.Done;
  }

  private openConversation(conversationId: string): void {
    const conversation = this.store.conversation(conversationId);
    if (Object.isNull(conversation))
      this.context.openDocument(Resources.conversationDocumentName, conversationId, Resources.untitledConversation);
    else
      ConversationActions.open(this.context, this.store, conversation, false);
  }

  private send(method: MethodName, parameters: JsonValue): void {
    void this.context.requestAsync(Resources.formatQualifiedName(method), parameters).catch(() => undefined);
  }
}
