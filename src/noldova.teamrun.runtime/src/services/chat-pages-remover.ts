/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IEventListener, type ILog, Resources as CoreResources } from "@noldova/teamrun.core";
import { ConversationIdParams, type Event, EventName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { Pages } from "./pages/pages.js";

export class ChatPagesRemover implements IEventListener {
  private readonly pages: Pick<Pages, "removeChatAsync">;
  private readonly log: ILog;

  public constructor(pages: Pick<Pages, "removeChatAsync">, log: ILog) {
    this.pages = pages;
    this.log = log;
  }

  public onEvent(event: Event): void {
    if (event.name !== EventName.ConversationDeleted)
      return;
    void this.removeAsync(ConversationIdParams.fromJson(event.payload).conversationId);
  }

  private async removeAsync(conversationId: string): Promise<void> {
    try {
      await this.pages.removeChatAsync(conversationId);
    }
    catch (error) {
      this.log.write(Resources.formatChatPagesNotRemoved(conversationId, CoreResources.formatFailureKind(error)));
    }
  }
}
