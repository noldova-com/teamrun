/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, SearchAnswer, SearchResult, SearchSourceContribution, TextRange } from "@noldova/desktop.window";
import { type ChatFindHit, ChatSearchHit, type MessageSearchHit } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ChatStoreService } from "./chat-store.service";
import { ConversationActions } from "./conversation-actions";
import { FormatterService } from "./formatter.service";

export class TeamRunSearchSources {
  private static readonly formatter: FormatterService = new FormatterService();

  public static of(context: IWindowPartContext): readonly SearchSourceContribution[] {
    const store = (): ChatStoreService => ChatStoreService.of(context);
    let searching: Promise<void> = Promise.resolve();
    return [
      new SearchSourceContribution(Resources.chatsSearchSource, Resources.chatsTitle, Resources.chatsPlaceholderName, Resources.chatsTitle, Resources.recentChatsHeading,
        Resources.chatsIcon, async () => (await store().findChats(String.empty)).hits.map(t => TeamRunSearchSources.chatResult(context, store(), t, String.empty)),
        async (query, signal) => {
          if (!await TeamRunSearchSources.typingStoppedAsync(signal))
            return new SearchAnswer([], 0);
          const found = await store().findChats(query);
          return new SearchAnswer(found.hits.map(t => TeamRunSearchSources.chatResult(context, store(), t, query)), found.total);
        }),
      new SearchSourceContribution(Resources.messagesSearchSource, Resources.messagesSearchLabel, Resources.messagesPlaceholderName, Resources.messagesSearchHeading, null,
        Resources.messagesSearchIcon, () => Promise.resolve([]), async (query, signal) => {
          if (!await TeamRunSearchSources.typingStoppedAsync(signal))
            return new SearchAnswer([], 0);
          await searching;
          if (signal.aborted)
            return new SearchAnswer([], 0);
          const request = store().searchMessages(query);
          searching = request.then(() => undefined, () => undefined);
          const found = await request;
          const now = Date.now();
          const total = found.capped ? Math.max(found.total, Resources.messageSearchCap) : found.total;
          return new SearchAnswer(found.hits.map(t => TeamRunSearchSources.messageResult(context, store(), t, query, now)), total);
        })
    ];
  }

  private static typingStoppedAsync(signal: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
      if (signal.aborted) {
        resolve(false);
        return;
      }
      const aborted = (): void => {
        clearTimeout(timer);
        resolve(false);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener(Resources.abortEvent, aborted);
        resolve(true);
      }, Resources.searchDelayMilliseconds);
      signal.addEventListener(Resources.abortEvent, aborted, { once: true });
    });
  }

  private static chatResult(context: IWindowPartContext, store: ChatStoreService, hit: ChatFindHit, query: string): SearchResult {
    const title = String.isNullOrWhitespace(hit.title) ? Resources.untitledConversation : hit.title;
    const project = Object.isNull(hit.projectId) ? null : store.projects().find(t => t.id === hit.projectId)?.name ?? null;
    const teammates = hit.teammateNames.length === 0 ? null : hit.teammateNames.join(Resources.teammateNamesSeparator);
    const detail = [project, teammates].filter(t => !Object.isNull(t)).join(Resources.titleSeparator);
    return new SearchResult(hit.chatId, title, detail,
      () => TeamRunSearchSources.open(context, store, new ChatSearchHit(hit.chatId, hit.projectId, title, null, String.empty, hit.updatedAt)),
      TeamRunSearchSources.rangeOf(title, query));
  }

  private static messageResult(context: IWindowPartContext, store: ChatStoreService, hit: MessageSearchHit, query: string, now: number): SearchResult {
    const chat = String.isNullOrWhitespace(hit.chatTitle) ? Resources.untitledConversation : hit.chatTitle;
    const author = TeamRunSearchSources.formatter.authorName(hit.author, hit.senderName, hit.teammateName, hit.providerId, hit.providerKind, store.kinds(),
      store.providers());
    const detail = Resources.formatMessageSearchDetail(author, chat,
      Resources.formatSince(Math.max(0, now - Date.parse(hit.createdAt))));
    return new SearchResult(hit.messageId, hit.snippet, detail,
      () => TeamRunSearchSources.open(context, store, new ChatSearchHit(hit.chatId, hit.projectId, chat, hit.messageId, hit.snippet, hit.createdAt, hit.sequence)),
      TeamRunSearchSources.rangeOf(hit.snippet, query));
  }

  private static async open(context: IWindowPartContext, store: ChatStoreService, hit: ChatSearchHit): Promise<void> {
    if (!store.isDeleted(hit.conversationId))
      await ConversationActions.show(context, store, hit);
  }

  private static rangeOf(text: string, query: string): TextRange | null {
    if (query.length === 0)
      return null;
    const start = text.toLowerCase().indexOf(query.toLowerCase());
    return start < 0 || start + query.length > text.length ? null : new TextRange(start, query.length);
  }
}
