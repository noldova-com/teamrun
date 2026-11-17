/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, type TopBarAction, TopBarActionContribution, TopBarActionState } from "@noldova/desktop.window";

import { Resources } from "../../resources";
import type { ChatStoreService } from "./chat-store.service";

export class ChatPageAction {
  private static readonly actions: WeakMap<IWindowPartContext, ChatPageAction> = new WeakMap();
  private readonly action: TopBarAction;
  private readonly unsubscribe: () => void;

  private constructor(context: IWindowPartContext, store: ChatStoreService) {
    this.action = context.registerTopBarAction(new TopBarActionContribution(Resources.chatPageAction, ChatPageAction.stateOf(store.shownConversationId())));
    this.unsubscribe = store.onShownConversationChanged(t => this.action.update(ChatPageAction.stateOf(t)));
  }

  public static register(context: IWindowPartContext, store: ChatStoreService): void {
    ChatPageAction.actions.set(context, new ChatPageAction(context, store));
  }

  public static release(context: IWindowPartContext): void {
    ChatPageAction.actions.get(context)?.unsubscribe();
    ChatPageAction.actions.delete(context);
  }

  public static stateOf(conversationId: string | null): TopBarActionState {
    return new TopBarActionState(Resources.openChatPageIcon, Object.isNull(conversationId) ? Resources.noChatPageTitle : Resources.openChatPageTitle,
      Resources.openChatPageCommand);
  }
}
