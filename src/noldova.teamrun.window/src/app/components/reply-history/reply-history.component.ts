/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, input, type InputSignal, type Signal, signal, untracked, viewChild, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import { ReplyPanel, type ReplySummary } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  VirtualListAlign,
  VirtualListComponent,
  VirtualListEdge,
  VirtualListKind,
  type VirtualListPosition,
  VirtualRowDirective
} from "@noldova/ui.components.angular";

import { MessageFocus } from "../../models/message-focus";
import type { ReplyHistorySource } from "../../models/reply-history-source";
import { Resources } from "../../../resources";
import { ChatStoreService } from "../../services/chat-store.service";
import { ReplyHistoryService } from "../../services/reply-history.service";
import { ReplyHistoryRowComponent } from "../reply-history-row/reply-history-row.component";

@Component({
  selector: "nol-teamrun-reply-history",
  imports: [ButtonComponent, ReplyHistoryRowComponent, VirtualListComponent, VirtualRowDirective],
  providers: [ChatStoreService.provider, ReplyHistoryService],
  host: { "(wheel)": "unpin()", "(pointerdown)": "unpin()", "(keydown)": "unpin()" },
  templateUrl: "./reply-history.component.html",
  styleUrl: "./reply-history.component.css"
})
export class ReplyHistoryComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly list: Signal<VirtualListComponent<ReplySummary> | undefined> = viewChild(VirtualListComponent);
  private shownFocus: MessageFocus | null = null;
  private pinnedId: string | null = null;
  private revealing: MessageFocus | null = null;

  public readonly panel: InputSignal<ReplyPanel> = input.required<ReplyPanel>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly history: ReplyHistoryService = inject(ReplyHistoryService);
  protected readonly feed: VirtualListKind = VirtualListKind.Feed;
  protected readonly newestLast: VirtualListEdge = VirtualListEdge.End;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly label: Signal<string> = computed(() => Resources.replyPanelTitles[this.panel()]);
  protected readonly emptyText: Signal<string> = computed(() =>
    this.panel() === ReplyPanel.Changes && this.history.ranCommands() ? Resources.noFolderChangesText : Resources.replyPanelEmptyTexts[this.panel()]);
  protected readonly selectedId: WritableSignal<string | null> = signal(null);
  protected readonly isEmpty: Signal<boolean> = computed(() =>
    (this.history.source()?.length() ?? 0) === 0 && !this.history.loading() && Object.isNull(this.history.error()));

  public constructor() {
    effect(() => {
      const conversationId = this.store.shownConversationId();
      const panel = this.panel();
      this.store.resyncs();
      untracked(() => {
        this.selectedId.set(null);
        this.shownFocus = null;
        this.unpin();
        this.history.select(conversationId, panel);
      });
    });
    effect(() => {
      const focus = this.store.planFocus();
      const list = this.list();
      if (this.panel() === ReplyPanel.Plan && Object.isNull(focus)) {
        untracked(() => this.clearSelection());
        return;
      }
      if (this.panel() !== ReplyPanel.Plan || Object.isNull(focus) || focus === this.shownFocus || Object.isUndefined(list)
        || focus.conversationId !== this.store.shownConversationId())
        return;
      this.history.source()?.length();
      untracked(() => void this.show(focus, list));
    });
  }

  private async show(focus: MessageFocus, list: VirtualListComponent<ReplySummary>): Promise<void> {
    this.shownFocus = focus;
    this.pinnedId = null;
    this.revealing = focus;
    const index = await this.history.indexOf(focus.messageId);
    if (focus !== this.store.planFocus())
      return;
    if (Object.isNull(index)) {
      this.shownFocus = null;
      return;
    }
    this.selectedId.set(focus.messageId);
    if (this.revealing !== focus)
      return;
    this.pinnedId = focus.messageId;
    list.reveal(index, VirtualListAlign.Start);
  }

  protected choose(summary: ReplySummary): void {
    const focus = new MessageFocus(summary.preview.conversationId, summary.preview.id, summary.preview.sequence, true);
    this.unpin();
    this.shownFocus = focus;
    this.selectedId.set(focus.messageId);
    this.store.showPlan(focus);
  }

  protected keepPinned(source: ReplyHistorySource, list: VirtualListComponent<ReplySummary>): void {
    if (Object.isNull(this.pinnedId))
      return;
    const index = source.items.findIndex(t => t.preview.id === this.pinnedId);
    if (index < 0)
      this.pinnedId = null;
    else
      list.reveal(index, VirtualListAlign.Start);
  }

  private clearSelection(): void {
    this.selectedId.set(null);
    this.shownFocus = null;
    this.unpin();
  }

  protected unpin(): void {
    this.pinnedId = null;
    this.revealing = null;
  }

  protected remember(position: VirtualListPosition): void {
    if (position.index < Resources.replyEdgeRows)
      void this.history.loadOlder();
  }
}
