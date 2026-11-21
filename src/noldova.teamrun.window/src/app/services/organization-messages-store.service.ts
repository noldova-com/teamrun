/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { EventName, Message, MessageIdParams, MessageStatus, MethodName, OrganizationMessage, OrganizationMessageSendParams, type OrganizationTarget }
  from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ListNotArrayException } from "../exceptions/list-not-array.exception";
import { OrganizationConversation } from "../models/organization-conversation";

export class OrganizationMessagesStoreService {
  public static readonly provider: FactoryProvider = {
    provide: OrganizationMessagesStoreService,
    useFactory: (): OrganizationMessagesStoreService => OrganizationMessagesStoreService.of(inject(WindowPartTokens.context))
  };

  private static readonly stores: WeakMap<IWindowPartContext, OrganizationMessagesStoreService> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly messagesSignal: WritableSignal<readonly OrganizationMessage[]> = signal([]);
  private readonly loadErrorSignal: WritableSignal<string | null> = signal(null);
  private readonly repliesErrorSignal: WritableSignal<string | null> = signal(null);
  private readonly unreadSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly replies: Map<string, WritableSignal<readonly Message[]>> = new Map();
  private readonly replyGenerations: Map<string, number> = new Map();
  private readonly counted: Set<string> = new Set();
  private readonly subscriptions: readonly (() => void)[];
  private sentIndex: ReadonlyMap<string, OrganizationMessage> = new Map();
  private generation: number = 0;

  public readonly messages: Signal<readonly OrganizationMessage[]> = this.messagesSignal.asReadonly();
  public readonly loadError: Signal<string | null> = this.loadErrorSignal.asReadonly();
  public readonly repliesError: Signal<string | null> = this.repliesErrorSignal.asReadonly();
  public readonly conversations: Signal<readonly OrganizationConversation[]> = computed(() => OrganizationConversation.group(this.messagesSignal()));

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.subscriptions = [
      context.onEvent(Resources.formatQualifiedName(EventName.OrganizationMessageUpdated), t => this.apply(OrganizationMessage.fromJson(t))),
      ...[EventName.MessageCreated, EventName.MessageUpdated].map(t => context.onEvent(Resources.formatQualifiedName(t), u => this.watch(Message.fromJson(u)))),
      context.onEvent(Resources.formatQualifiedName(EventName.StateResyncRequested), () => void this.resync())
    ];
    void this.reload();
  }

  public static of(context: IWindowPartContext): OrganizationMessagesStoreService {
    const found = OrganizationMessagesStoreService.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new OrganizationMessagesStoreService(context);
    OrganizationMessagesStoreService.stores.set(context, store);
    return store;
  }

  public static release(context: IWindowPartContext): void {
    OrganizationMessagesStoreService.stores.get(context)?.dispose();
    OrganizationMessagesStoreService.stores.delete(context);
  }

  public async reload(): Promise<void> {
    const generation = ++this.generation;
    try {
      const answer = await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationMessageList), null);
      if (!Array.isArray(answer))
        throw new ListNotArrayException(Resources.formatValueKind(answer));
      const messages = answer.map(t => OrganizationMessage.fromJson(t));
      if (generation === this.generation) {
        this.setMessages(messages);
        this.loadErrorSignal.set(null);
      }
    }
    catch (error) {
      if (generation === this.generation)
        this.loadErrorSignal.set(error instanceof Error ? error.message : String(error));
    }
  }

  public repliesOf(messageId: string): Signal<readonly Message[]> {
    const found = this.replies.get(messageId);
    if (!Object.isUndefined(found) && this.replyGenerations.has(messageId))
      return found.asReadonly();
    const replies = found ?? signal<readonly Message[]>([]);
    this.replies.set(messageId, replies);
    void this.reloadReplies(messageId, replies);
    return replies.asReadonly();
  }

  public unreadOf(target: OrganizationTarget): number {
    const key = OrganizationConversation.keyOf(target);
    return [...this.unreadSignal().values()].filter(t => t === key).length;
  }

  public markRead(target: OrganizationTarget): void {
    const key = OrganizationConversation.keyOf(target);
    const unread = this.unreadSignal();
    if ([...unread.values()].includes(key))
      this.unreadSignal.set(new Map([...unread].filter(t => t[1] !== key)));
  }

  public async sendAsync(target: OrganizationTarget, text: string): Promise<OrganizationMessage> {
    const sent = OrganizationMessage.fromJson(await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationMessageSend),
      new OrganizationMessageSendParams(target, text).toJson()));
    this.apply(sent);
    return sent;
  }

  public async stopAsync(messageId: string): Promise<void> {
    this.apply(OrganizationMessage.fromJson(await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationMessageStop),
      new MessageIdParams(messageId).toJson())));
  }

  private async resync(): Promise<void> {
    await this.reload();
    await Promise.all([...this.replies].filter(t => this.replyGenerations.has(t[0])).map(([id, replies]) => this.reloadReplies(id, replies)));
  }

  private async reloadReplies(messageId: string, replies: WritableSignal<readonly Message[]>): Promise<void> {
    const generation = (this.replyGenerations.get(messageId) ?? 0) + 1;
    this.replyGenerations.set(messageId, generation);
    const live = new Map(replies().map(t => [t.id, t]));
    try {
      const answer = await this.context.requestAsync(Resources.formatQualifiedName(MethodName.OrganizationMessageReplyList),
        new MessageIdParams(messageId).toJson());
      if (!Array.isArray(answer))
        throw new ListNotArrayException(Resources.formatValueKind(answer));
      const loaded = answer.map(t => Message.fromJson(t));
      if (generation !== this.replyGenerations.get(messageId))
        return;
      const current = new Map(replies().filter(t => live.get(t.id) !== t).map(t => [t.id, t]));
      replies.set(OrganizationMessagesStoreService.ordered([...loaded.filter(t => !current.has(t.id)), ...current.values()]));
      for (const reply of loaded.filter(t => t.status === MessageStatus.Completed))
        this.counted.add(reply.id);
      this.repliesErrorSignal.set(null);
    }
    catch (error) {
      if (generation === this.replyGenerations.get(messageId))
        this.repliesErrorSignal.set(error instanceof Error ? error.message : String(error));
    }
  }

  private watch(message: Message): void {
    const answered = Object.isNull(message.inReplyTo) ? undefined : this.sentIndex.get(message.inReplyTo);
    if (Object.isUndefined(answered))
      return;
    const replies = this.replies.get(answered.id) ?? signal<readonly Message[]>([]);
    this.replies.set(answered.id, replies);
    replies.set(OrganizationMessagesStoreService.ordered([...replies().filter(t => t.id !== message.id), message]));
    if (message.status === MessageStatus.Completed && !this.counted.has(message.id)) {
      this.counted.add(message.id);
      this.unreadSignal.update(t => new Map(t).set(message.id, OrganizationConversation.keyOf(answered.target)));
    }
  }

  private apply(message: OrganizationMessage): void {
    this.generation++;
    const messages = this.messagesSignal();
    const index = messages.findIndex(t => t.id === message.id);
    this.setMessages(index < 0 ? [...messages, message] : messages.with(index, message));
  }

  private setMessages(messages: readonly OrganizationMessage[]): void {
    this.messagesSignal.set(messages);
    this.sentIndex = new Map(messages.flatMap(t => t.recipients.flatMap((u): [string, OrganizationMessage][] => Object.isNull(u.messageId) ? [] : [[u.messageId, t]])));
  }

  private dispose(): void {
    this.generation++;
    this.replyGenerations.clear();
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }

  private static ordered(replies: readonly Message[]): readonly Message[] {
    return [...replies].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.sequence - b.sequence);
  }
}
