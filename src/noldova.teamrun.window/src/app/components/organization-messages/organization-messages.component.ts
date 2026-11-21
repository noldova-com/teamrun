/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type ModelSignal, type Signal, type WritableSignal, computed, effect, inject, input, model, signal, untracked }
  from "@angular/core";

import "@noldova/context.core";
import { DetailKind, type Message, MessageStatus, type OrganizationMessage, OrganizationRecipientState, OrganizationTarget, OrganizationTargetKind,
  type Teammate } from "@noldova/teamrun.protocol";
import { AvatarSize, ChipComponent, IconButtonComponent, MessageAuthor as Author, MessageAuthorKind, type MessageBlock, MessageComponent,
  MessageLayout, MessageStatus as Status, MessageText, SelectComponent, SelectGroup, SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationMessagesShape } from "../../enums/organization-messages-shape";
import { OrganizationConversation } from "../../models/organization-conversation";
import { ChatStoreService } from "../../services/chat-store.service";
import { FormatterService } from "../../services/formatter.service";
import { OrganizationMessagesStoreService } from "../../services/organization-messages-store.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TimeFormatService } from "../../services/time-format.service";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";

interface ConversationRow {
  readonly conversation: OrganizationConversation;
  readonly title: string;
  readonly teammate: Teammate | null;
  readonly icon: string;
  readonly time: string;
  readonly lastLine: string;
  readonly unread: number;
}

interface ThreadEntry {
  readonly message: OrganizationMessage;
  readonly blocks: readonly MessageBlock[];
  readonly lines: readonly string[];
  readonly failures: readonly string[];
  readonly stoppable: boolean;
  readonly replies: readonly ReplyEntry[];
}

interface ReplyEntry {
  readonly reply: Message;
  readonly author: Author;
  readonly blocks: readonly MessageBlock[];
  readonly status: Status;
}

@Component({
  selector: "nol-teamrun-organization-messages",
  imports: [ChipComponent, IconButtonComponent, MessageComponent, SelectComponent, TeammateAvatarComponent, TextFieldComponent],
  providers: [OrganizationMessagesStoreService.provider, OrganizationStoreService.provider],
  templateUrl: "./organization-messages.component.html",
  styleUrl: "./organization-messages.component.css",
  host: {
    "[class.nol-teamrun-organization-messages-inbox]": "shape() === shapes.Inbox"
  }
})
export class OrganizationMessagesComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly shapes: typeof OrganizationMessagesShape = OrganizationMessagesShape;
  protected readonly column: MessageLayout = MessageLayout.Column;
  protected readonly smallAvatar: AvatarSize = AvatarSize.Small;
  protected readonly you: Author = new Author(Resources.personAuthorId, Resources.youLabel, MessageAuthorKind.Person);
  protected readonly store: OrganizationMessagesStoreService = inject(OrganizationMessagesStoreService);
  private readonly organizations: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly chats: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly times: TimeFormatService = inject(TimeFormatService);

  public readonly target: ModelSignal<OrganizationTarget | null> = model<OrganizationTarget | null>(null);
  public readonly shape: InputSignal<OrganizationMessagesShape> = input<OrganizationMessagesShape>(OrganizationMessagesShape.Inbox);

  protected readonly draft: WritableSignal<string> = signal(String.empty);
  protected readonly sending: WritableSignal<boolean> = signal(false);
  protected readonly actionError: WritableSignal<string | null> = signal(null);
  protected readonly error: Signal<string | null> = computed(() => this.actionError() ?? this.store.loadError() ?? this.store.repliesError());

  protected readonly rows: Signal<readonly ConversationRow[]> = computed(() => this.store.conversations().map(t => {
    const shown = this.store.repliesOf(t.last.id)().flatMap(u => {
      const text = OrganizationMessagesComponent.textOf(u);
      return Object.isUndefined(text) ? [] : [{ reply: u, text }];
    }).at(-1);
    return {
      conversation: t,
      title: this.titleOf(t.target, t.last),
      teammate: t.target.kind === OrganizationTargetKind.Teammate ? this.chats.teammate(t.target.id) : null,
      icon: t.target.kind === OrganizationTargetKind.Department ? Resources.organizationDepartmentIcon : Resources.organizationGroupIcon,
      time: this.times.shortDateTime(shown?.reply.createdAt ?? t.last.createdAt),
      lastLine: Object.isUndefined(shown) ? Resources.formatOrganizationLastLine(Resources.youLabel, t.last.text)
        : Resources.formatOrganizationLastLine(this.replyAuthor(shown.reply).name, shown.text),
      unread: this.store.unreadOf(t.target)
    };
  }));
  protected readonly unreadCount: Signal<number> = computed(() => this.rows().reduce((sum, t) => sum + t.unread, 0));
  protected readonly selectedKey: Signal<string | null> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? null : OrganizationConversation.keyOf(target);
  });
  protected readonly title: Signal<string> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? String.empty : this.titleOf(target, this.messages().at(-1) ?? null);
  });
  protected readonly note: Signal<string> = computed(() => {
    const target = this.target();
    if (Object.isNull(target))
      return String.empty;
    switch (target.kind) {
      case OrganizationTargetKind.Teammate:
        return this.chats.teammate(target.id)?.role ?? Resources.organizationTeammateNote;
      case OrganizationTargetKind.Department:
        return Resources.formatOrganizationDepartmentNote(this.recipientCount());
      case OrganizationTargetKind.Leaders:
        return Resources.organizationLeadersNote;
      case OrganizationTargetKind.Everyone:
        return Resources.formatOrganizationEveryoneNote(this.recipientCount());
    }
  });
  protected readonly recipientCount: Signal<number> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? 0 : this.organizations.organization().recipientsOf(target, this.chats.teammates().map(t => t.id)).length;
  });
  protected readonly messages: Signal<readonly OrganizationMessage[]> = computed(() =>
    this.store.conversations().find(t => t.key === this.selectedKey())?.messages ?? []);
  protected readonly entries: Signal<readonly ThreadEntry[]> = computed(() => this.messages().map(t => this.entryOf(t)));
  protected readonly replying: Signal<string> = computed(() => {
    const names = this.entries().flatMap(t => t.replies.filter(u => u.status === Status.Streaming).map(u => u.author.name));
    return names.length === 0 ? String.empty : Resources.formatOrganizationReplying([...new Set(names)]);
  });
  private readonly targets: Signal<readonly OrganizationTarget[]> = computed(() => [OrganizationTarget.everyone, OrganizationTarget.leaders,
    ...this.organizations.organization().departments.map(t => OrganizationTarget.department(t.id)),
    ...this.chats.teammates().map(t => OrganizationTarget.teammate(t.id))]);
  protected readonly options: Signal<readonly SelectGroup[]> = computed(() => [
    new SelectGroup(Resources.organizationTargetsGroup, [OrganizationTarget.everyone, OrganizationTarget.leaders].map(t => this.optionOf(t))),
    new SelectGroup(Resources.organizationDepartmentsGroup, this.organizations.organization().departments.map(t => this.optionOf(OrganizationTarget.department(t.id)))),
    new SelectGroup(Resources.organizationTeammatesGroup, this.chats.teammates().map(t => this.optionOf(OrganizationTarget.teammate(t.id))))
  ]);
  protected readonly selectedValue: Signal<string> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? String.empty : OrganizationMessagesComponent.valueOf(target);
  });
  protected readonly canSend: Signal<boolean> = computed(() => !this.sending() && this.recipientCount() > 0 && this.draft().trim().length > 0);

  public constructor() {
    effect(() => {
      const target = this.target();
      if (!Object.isNull(target) && this.store.unreadOf(target) > 0)
        untracked(() => this.store.markRead(target));
    });
  }

  protected open(conversation: OrganizationConversation): void {
    this.target.set(conversation.target);
  }

  protected choose(value: string): void {
    const chosen = this.targets().find(t => OrganizationMessagesComponent.valueOf(t) === value);
    if (!Object.isUndefined(chosen))
      this.target.set(chosen);
  }

  protected async send(): Promise<void> {
    const target = this.target();
    if (!this.canSend() || Object.isNull(target))
      return;
    this.sending.set(true);
    this.actionError.set(null);
    try {
      await this.store.sendAsync(target, this.draft().trim());
      this.draft.set(String.empty);
    }
    catch (error) {
      this.actionError.set(Resources.formatOrganizationSendFailed(error instanceof Error ? error.message : String(error)));
    }
    finally {
      this.sending.set(false);
    }
  }

  protected async stop(message: OrganizationMessage): Promise<void> {
    this.actionError.set(null);
    try {
      await this.store.stopAsync(message.id);
    }
    catch (error) {
      this.actionError.set(Resources.formatOrganizationStopFailed(error instanceof Error ? error.message : String(error)));
    }
  }

  protected time(at: string): Date {
    return new Date(at);
  }

  private entryOf(message: OrganizationMessage): ThreadEntry {
    const states = [OrganizationRecipientState.Started, OrganizationRecipientState.Queued, OrganizationRecipientState.Stopped,
      OrganizationRecipientState.Removed, OrganizationRecipientState.Failed];
    const lines = states.flatMap(t => {
      const names = message.recipients.filter(u => u.state === t).map(u => u.teammateName);
      return names.length === 0 ? [] : [Resources.formatOrganizationRecipients(t, names)];
    });
    return {
      message,
      blocks: [new MessageText(message.text)],
      lines,
      failures: message.recipients.flatMap(t => t.state !== OrganizationRecipientState.Failed || Object.isNull(t.reason) ? []
        : [Resources.formatOrganizationFailure(t.teammateName, t.reason)]),
      stoppable: message.recipients.some(t => t.state === OrganizationRecipientState.Queued),
      replies: this.store.repliesOf(message.id)().map(t => ({
        reply: t,
        author: this.replyAuthor(t),
        blocks: t.details.filter(u => u.kind === DetailKind.Text).map(u => new MessageText(u.text)),
        status: OrganizationMessagesComponent.statusOf(t.status)
      }))
    };
  }

  private optionOf(target: OrganizationTarget): SelectOption {
    return new SelectOption(OrganizationMessagesComponent.valueOf(target), this.titleOf(target, null));
  }

  private replyAuthor(reply: Message): Author {
    return this.formatter.replyAuthor(reply, this.chats.kinds(), this.chats.providers(), this.chats.isReplyAuthorUnavailable(reply.teammateId));
  }

  private titleOf(target: OrganizationTarget, message: OrganizationMessage | null): string {
    switch (target.kind) {
      case OrganizationTargetKind.Teammate:
        return this.chats.teammate(target.id)?.name ?? message?.recipients.find(t => t.teammateId === target.id)?.teammateName
          ?? Resources.organizationRemovedTeammate;
      case OrganizationTargetKind.Department:
        return this.organizations.organization().departments.find(t => t.id === target.id)?.name ?? Resources.organizationDeletedDepartment;
      case OrganizationTargetKind.Leaders:
        return Resources.organizationLeadersTitle;
      case OrganizationTargetKind.Everyone:
        return Resources.organizationEveryoneTitle;
    }
  }

  private static textOf(reply: Message): string | undefined {
    return reply.details.filter(t => t.kind === DetailKind.Text).map(t => t.text.trim()).filter(t => t.length > 0).at(-1);
  }

  private static valueOf(target: OrganizationTarget): string {
    return [target.kind, target.id ?? String.empty].join(Resources.organizationTargetSeparator);
  }

  private static statusOf(status: MessageStatus): Status {
    switch (status) {
      case MessageStatus.Pending:
      case MessageStatus.Running:
      case MessageStatus.AwaitingApproval:
        return Status.Streaming;
      case MessageStatus.Failed:
      case MessageStatus.Interrupted:
        return Status.Error;
      case MessageStatus.Cancelled:
        return Status.Cancelled;
      case MessageStatus.Completed:
        return Status.Complete;
    }
  }
}
