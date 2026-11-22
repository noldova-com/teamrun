/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, inject, input, type InputSignal, output, type OutputEmitterRef, type Signal, signal, untracked,
  type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { DetailKind, type Message, MessageAuthor } from "@noldova/teamrun.protocol";
import { AvatarSize, ChipComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationChatRow } from "../../models/organization-chat-row";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TimeFormatService } from "../../services/time-format.service";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";

@Component({
  selector: "nol-teamrun-organization-chats",
  imports: [ChipComponent, TeammateAvatarComponent],
  providers: [OrganizationStoreService.provider],
  templateUrl: "./organization-chats.component.html",
  styleUrl: "./organization-chats.component.css"
})
export class OrganizationChatsComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly organizations: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly times: TimeFormatService = inject(TimeFormatService);
  private readonly latest: WritableSignal<ReadonlyMap<string, Message>> = signal(new Map());
  private readonly unread: WritableSignal<ReadonlyMap<string, number>> = signal(new Map());
  private readonly reading: Set<string> = new Set();

  public readonly selectedTeammateId: InputSignal<string | null> = input<string | null>(null);
  public readonly chosen: OutputEmitterRef<string> = output<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly avatar: AvatarSize = AvatarSize.Normal;
  protected readonly rows: Signal<readonly OrganizationChatRow[]> = computed(() => [...this.store.organizationChatsByTeammate(this.organizations.id())]
    .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
    .map(([teammateId, chat]) => {
      const teammate = this.store.teammate(teammateId);
      const name = teammate?.name ?? Resources.organizationRemovedTeammate;
      const last = this.latest().get(chat.id);
      const running = this.store.runningReplyOf(chat.id);
      return new OrganizationChatRow(chat.id, teammateId, teammate, name, this.times.shortDateTime(last?.createdAt ?? chat.updatedAt),
        Object.isUndefined(last) ? String.empty : Resources.formatOrganizationLastLine(last.author === MessageAuthor.User ? Resources.youLabel : name,
          OrganizationChatsComponent.textOf(last)),
        Object.isNull(running) ? null : Resources.organizationRecipientStatusLabels[running.status], this.unread().get(chat.id) ?? 0);
    }));
  protected readonly unreadCount: Signal<number> = computed(() => this.rows().reduce((sum, t) => sum + t.unread, 0));

  public constructor() {
    const stopWatching = this.store.onReplyEnded(t => {
      if (this.store.organizationChats(this.organizations.id()).some(u => u.id === t.conversationId)) {
        this.latest.update(u => new Map(u).set(t.conversationId, t));
        if (this.store.organizationChatOf(this.organizations.id(), this.selectedTeammateId() ?? String.empty)?.id !== t.conversationId)
          this.unread.update(u => new Map(u).set(t.conversationId, (u.get(t.conversationId) ?? 0) + 1));
      }
    });
    inject(DestroyRef).onDestroy(stopWatching);
    effect(() => {
      const chats = this.store.organizationChats(this.organizations.id());
      untracked(() => chats.filter(t => !this.reading.has(t.id)).forEach(t => void this.read(t.id)));
    });
    effect(() => {
      const chatId = this.store.organizationChatOf(this.organizations.id(), this.selectedTeammateId() ?? String.empty)?.id;
      if (!Object.isUndefined(chatId) && (untracked(() => this.unread().get(chatId)) ?? 0) > 0)
        untracked(() => this.unread.update(t => {
          const next = new Map(t);
          next.delete(chatId);
          return next;
        }));
    });
  }

  protected choose(row: OrganizationChatRow): void {
    this.chosen.emit(row.teammateId);
  }

  private async read(chatId: string): Promise<void> {
    this.reading.add(chatId);
    try {
      const message = await this.store.latestMessageOf(chatId);
      if (!Object.isNull(message))
        this.latest.update(t => new Map([[chatId, message], ...t]));
    }
    catch {
      this.reading.delete(chatId);
    }
  }

  private static textOf(message: Message): string {
    return message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text.trim()).filter(t => t.length > 0).at(-1) ?? String.empty;
  }
}
