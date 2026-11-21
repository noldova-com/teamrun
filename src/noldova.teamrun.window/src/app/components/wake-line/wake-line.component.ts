/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, input, type InputSignal, type Signal, untracked } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { type Conversation, DetailKind, type Message, MessageAuthor, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../../resources";
import { MessageControlState } from "../../models/message-control-state";
import type { WakeReceived } from "../../models/wake-received";
import type { WakeReply } from "../../models/wake-reply";
import { ChatStoreService } from "../../services/chat-store.service";
import { ConversationActions } from "../../services/conversation-actions";

@Component({
  selector: "nol-teamrun-wake-line",
  templateUrl: "./wake-line.component.html",
  styleUrls: ["./wake-line.component.css"],
  host: { "[class.nol-teamrun-wake-line-alone]": "alone()" }
})
export class WakeLineComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly store: ChatStoreService = inject(ChatStoreService);

  private readonly fallback: MessageControlState = new MessageControlState();

  public readonly message: InputSignal<Message> = input.required<Message>();
  public readonly received: InputSignal<WakeReceived> = input.required<WakeReceived>();
  public readonly state: InputSignal<MessageControlState | null> = input<MessageControlState | null>(null);
  public readonly alone: InputSignal<boolean> = input<boolean>(false);
  public readonly labelId: InputSignal<string | null> = input<string | null>(null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly commandTask: string = ProtocolResources.wakeCommandTask;
  protected readonly chat: Signal<Conversation | null> = computed(() => {
    const chatId = this.received().chatId;
    return Object.isNull(chatId) ? null : this.store.conversation(chatId);
  });
  protected readonly controls: Signal<MessageControlState> = computed(() => {
    const message = this.message();
    return this.state() ?? this.store.messageControlsOf(message.conversationId, message.id) ?? this.fallback;
  });
  protected readonly endText: Signal<string | null> = computed(() => {
    const { end, task } = this.received();
    if (end === ProtocolResources.wakeChatDeletedEnd)
      return Resources.wakeChatDeletedText;
    if (end !== ProtocolResources.wakeLostEnd)
      return null;
    return Object.isNull(task) ? Resources.wakeLostText : task.kind === ProtocolResources.wakeCommandTask ? Resources.wakeCommandLostText : Resources.wakeTaskLostText;
  });
  protected readonly label: Signal<string> = computed(() => {
    const { chatId, end, task } = this.received();
    if (!Object.isNull(task))
      return Resources.formatTaskWakeLabel(task.kind, task.name, task.ending);
    if (Object.isNull(chatId))
      return Resources.wakeOldTaskLabel;
    return Object.isNull(end) ? Resources.wakeReceivedLabel : Resources.wakeEndedLabel;
  });
  protected readonly regionLabel: Signal<string> = computed(() => {
    const { end, task } = this.received();
    if (Object.isNull(task))
      return Object.isNull(end) ? Resources.wakeRepliesLabel : Resources.wakeNoReplyLabel;
    if (end === ProtocolResources.wakeLostEnd)
      return Resources.wakeTaskLostLabel;
    return task.kind === ProtocolResources.wakeCommandTask ? Resources.wakeCommandOutputLabel : Resources.wakeSubAgentResultLabel;
  });
  protected readonly expandable: Signal<boolean> = computed(() => {
    const { replies, task } = this.received();
    return replies.length > 0 || !Object.isNull(this.endText()) || !Object.isNull(task?.text ?? null);
  });
  protected readonly notes: Signal<readonly string[]> = computed(() => {
    const message = this.message();
    return message.author === MessageAuthor.User ? message.details.filter(t => t.kind === DetailKind.Note).map(t => t.text) : [];
  });
  protected readonly isOpen: Signal<boolean> = computed(() => this.controls().wakeChoice() ?? false);

  public constructor() {
    effect(() => {
      const message = this.message();
      const controls = this.controls();
      controls.hasChanges;
      if (Object.isNull(this.state()))
        untracked(() => this.store.rememberMessageControls(message.id, controls, message.conversationId));
    });
  }

  protected toggle(): void {
    this.controls().wakeChoice.set(!this.isOpen());
  }

  protected open(chat: Conversation): void {
    ConversationActions.open(this.context, this.store, chat);
  }

  protected headingOf(reply: WakeReply): string {
    return Resources.formatWakeReplyHeading(reply.name, reply.status, reply.text);
  }
}
