/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal } from "@angular/core";

import "@noldova/context.core";

import { PageCardComponent } from "../components/pages/page-card/page-card.component";
import type { ChatStoreService } from "./chat-store.service";
import { FormatterService } from "./formatter.service";

export class PageEditors {
  private static readonly formatter: FormatterService = new FormatterService();

  public static of(store: Pick<ChatStoreService, "shownConversationId" | "historyOf" | "workingReplies" | "kinds" | "providers" | "isReplyAuthorUnavailable" | "teammateColor">):
    Signal<ReadonlyMap<string, string>> {
    return computed(() => {
      const chatId = store.shownConversationId();
      const history = store.historyOf(chatId);
      const editors = new Map<string, string>();
      if (Object.isNull(history))
        return editors;
      history.revision();
      for (const reply of store.workingReplies().filter(t => t.conversationId === chatId).toSorted((a, b) => a.sequence - b.sequence)) {
        const message = history.find(reply.id) ?? reply;
        const name = PageEditors.formatter.replyAuthor(message, store.kinds(), store.providers(), store.isReplyAuthorUnavailable(message.teammateId), store.teammateColor(message.teammateId)).name;
        for (const entry of PageEditors.formatter.activity(message)) {
          const step = PageCardComponent.stepOf(entry.detail.payload, entry.detail.text, entry.result?.text ?? null);
          if (!Object.isNull(step) && Object.isNull(step.page) && PageEditors.formatter.isStepRunning(message, entry))
            editors.set(step.pageId, name);
        }
      }
      return editors;
    });
  }
}
