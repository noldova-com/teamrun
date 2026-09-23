/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { FileChangeReader, Message, MessageIdParams, MethodName, ReplyPanel, type ReplySummary } from "@noldova/teamrun-protocol";

import { ReplyHistoryItem } from "../../models/reply-history-item";
import { Resources } from "../../resources";
import { BridgeService } from "../../services/bridge.service";
import { ChatStore } from "../../services/chat-store.service";
import { Formatter } from "../../services/formatter.service";
import { ActivityBlockComponent } from "../activity-block/activity-block.component";
import { EditedFilesCardComponent } from "../edited-files-card/edited-files-card.component";

@Component({
  selector: "tr-reply-history-row",
  imports: [ActivityBlockComponent, EditedFilesCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "relative block flow-root", "[attr.data-message-id]": "item().summary.preview.id",
    "[style.min-height.px]": "isRestoring() ? reservedHeight() : null" },
  templateUrl: "./reply-history-row.component.html"
})
export class ReplyHistoryRowComponent {
  private readonly bridge = inject(BridgeService);
  private readonly destroy = inject(DestroyRef);
  private readonly full = signal<Message | null>(null);
  private loaded: ReplySummary | null = null;
  private pending: Promise<boolean> | null = null;
  private revision: number = 0;
  private wasOpen: boolean = false;

  protected readonly formatter = inject(Formatter);
  protected readonly chat = inject(ChatStore);
  protected readonly resources = Resources;
  protected readonly activityPanel = ReplyPanel.Activity;
  protected readonly rootPath = computed(() => this.chat.selectedProject()?.rootPath ?? null);
  protected readonly entries = computed(() => this.formatter.activity(this.full() ?? this.item().summary.preview));
  protected readonly edits = computed(() => {
    const message = this.full();
    return Object.isNull(message) ? null : new FileChangeReader().editsOf(message);
  });
  protected readonly loading = signal(false);
  protected readonly isRestoring = computed(() => Object.isNull(this.full())
    && this.item().expansion.activity().size + this.item().expansion.files().size > 0);
  protected readonly error = signal<string | null>(null);

  public readonly item = input.required<ReplyHistoryItem>();
  public readonly panel = input.required<ReplyPanel>();
  public readonly reservedHeight = input(0);
  public readonly ensureDetails = (): Promise<boolean> => {
    if (this.loaded === this.item().summary)
      return Promise.resolve(true);
    if (!Object.isNull(this.pending))
      return this.pending;
    this.pending = this.readDetails().finally(() => this.pending = null);
    return this.pending;
  };

  public constructor() {
    effect(() => {
      const item = this.item();
      const open = item.expansion.activity().size + item.expansion.files().size > 0;
      untracked(() => {
        if (open) {
          this.wasOpen = true;
          if (this.loaded !== item.summary)
            void this.ensureDetails();
        } else if (this.wasOpen) {
          this.wasOpen = false;
          this.revision += 1;
          this.full.set(null);
          this.loaded = null;
        }
      });
    });
  }

  private async readDetails(): Promise<boolean> {
    const revision = this.revision;
    this.loading.set(true);
    this.error.set(null);
    try {
      while (!this.destroy.destroyed && revision === this.revision) {
        const summary = this.item().summary;
        const value = await this.bridge.call(MethodName.MessageDetails, new MessageIdParams(summary.preview.id).toJson());
        if (this.destroy.destroyed || revision !== this.revision || Object.isNull(value))
          return false;
        if (summary !== this.item().summary)
          continue;
        this.full.set(Message.fromJson(value));
        this.loaded = summary;
        return true;
      }
      return false;
    }
    catch (error) {
      if (!this.destroy.destroyed)
        this.error.set(error instanceof Error ? error.message : String(error));
      return false;
    }
    finally {
      this.loading.set(false);
    }
  }
}
