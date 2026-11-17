/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ElementRef, inject, input, type InputSignal, output, type OutputEmitterRef,
  type Signal, signal, untracked, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import { FileChangeReader, type FileEdit, type Message, ReplyPanel, type ReplyPlan, type ReplySummary } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  type LinkOpenEvent,
  type MessageAuthor as Author,
  type MessageBlock,
  MessageComponent,
  MessageLayout,
  MessageSelectionLook,
  MessageSlot,
  MessageSlotDirective,
  MessageTimeFormat
} from "@noldova/ui.components.angular";

import type { ActivityEntry } from "../../models/activity-entry";
import type { ReplyExpansion } from "../../models/reply-expansion";
import { Resources } from "../../../resources";
import { ChatStoreService } from "../../services/chat-store.service";
import { FormatterService } from "../../services/formatter.service";
import { ImageViewerService } from "../../services/image-viewer.service";
import { ReplyHistoryService } from "../../services/reply-history.service";
import { ReplyLinksService } from "../../services/reply-links.service";
import { TimeFormatService } from "../../services/time-format.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { ActivityBlockComponent } from "../activity-block/activity-block.component";
import { EditedFilesComponent } from "../edited-files/edited-files.component";
import { PlanCardComponent } from "../plan-card/plan-card.component";

@Component({
  selector: "nol-teamrun-reply-history-row",
  imports: [ActivityBlockComponent, ButtonComponent, EditedFilesComponent, MessageComponent, MessageSlotDirective, PlanCardComponent],
  providers: [ImageViewerService.provider, ReplyLinksService],
  host: { "[class.nol-teamrun-reply-plan-row]": "panel() === planPanel" },
  templateUrl: "./reply-history-row.component.html",
  styleUrl: "./reply-history-row.component.css"
})
export class ReplyHistoryRowComponent {
  private readonly history: ReplyHistoryService = inject(ReplyHistoryService);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly usage: UsageFormatterService = inject(UsageFormatterService);
  private readonly links: ReplyLinksService = inject(ReplyLinksService);
  private readonly times: TimeFormatService = inject(TimeFormatService);
  private readonly details: WritableSignal<Message | null> = signal(null);
  private loaded: ReplySummary | null = null;
  private pending: Promise<boolean> | null = null;
  private revision: number = 0;
  private shownId: string | null = null;
  private wasOpen: boolean = false;

  public readonly summary: InputSignal<ReplySummary> = input.required<ReplySummary>();
  public readonly panel: InputSignal<ReplyPanel> = input.required<ReplyPanel>();
  public readonly labelId: InputSignal<string | null> = input<string | null>(null);
  public readonly selected: InputSignal<boolean> = input<boolean>(false);
  public readonly resized: OutputEmitterRef<void> = output<void>();
  public readonly chosen: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly activityPanel: ReplyPanel = ReplyPanel.Activity;
  protected readonly planPanel: ReplyPanel = ReplyPanel.Plan;
  protected readonly column: MessageLayout = MessageLayout.Column;
  protected readonly raisedSelection: MessageSelectionLook = MessageSelectionLook.Raised;
  protected readonly clockTime: MessageTimeFormat = MessageTimeFormat.Clock;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly message: Signal<Message> = computed(() => this.details() ?? this.summary().preview);
  protected readonly entries: Signal<readonly ActivityEntry[]> = computed(() => this.formatter.activity(this.message()));
  protected readonly edits: Signal<readonly FileEdit[] | null> = computed(() => {
    const details = this.details();
    return Object.isNull(details) ? null : new FileChangeReader().editsOf(details);
  });
  protected readonly author: Signal<string> = computed(() => this.formatter.authorLabel(this.summary().preview, this.store.kinds(), this.store.providers()));
  protected readonly replyAuthor: Signal<Author> = computed(() =>
    this.formatter.replyAuthor(this.summary().preview, this.store.kinds(), this.store.providers(),
      this.store.isReplyAuthorUnavailable(this.summary().preview.teammateId)));
  protected readonly createdAt: Signal<Date> = computed(() => new Date(this.summary().preview.createdAt));
  protected readonly plan: Signal<ReplyPlan | null> = computed(() => this.formatter.planOf(this.summary().preview));
  protected readonly planBlocks: readonly MessageBlock[] = [new MessageSlot(Resources.planBlockSlot)];
  protected readonly planCopyText: Signal<string | null> = computed(() => {
    const plan = this.plan();
    if (Object.isNull(plan))
      return null;
    const checklist = plan.steps.map(t => t.text).join(Resources.lineSeparator);
    return [plan.text ?? String.empty, checklist].filter(t => !String.isNullOrEmpty(t)).join(Resources.paragraphSeparator);
  });
  protected readonly time: Signal<string> = computed(() => this.times.time(this.summary().preview.createdAt));
  protected readonly stats: Signal<string | null> = computed(() => this.panel() === ReplyPanel.Activity && !this.formatter.isActive(this.summary().preview)
    ? this.usage.replyStats(this.summary().preview) : null);
  protected readonly changesNotes: Signal<readonly string[]> = computed(() => this.formatter.changesNotesOf(this.summary().preview));
  protected readonly expansion: Signal<ReplyExpansion> = computed(() => this.history.expansionOf(this.summary().preview.id));
  protected readonly rootPath: Signal<string | null> = computed(() => this.store.folderOf(this.message().conversationId));
  protected readonly isOpen: Signal<boolean> = computed(() => this.expansion().activity().size + this.expansion().files().size > 0);

  public readonly ensureDetails = (): Promise<boolean> => {
    if (this.loaded === this.summary())
      return Promise.resolve(true);
    if (Object.isNull(this.pending)) {
      const pending: Promise<boolean> = this.readDetails().finally(() => {
        if (this.pending === pending)
          this.pending = null;
      });
      this.pending = pending;
    }
    return this.pending;
  };

  public constructor() {
    const sizes = new ResizeObserver(() => this.resized.emit());
    sizes.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => {
      sizes.disconnect();
      this.revision++;
    });
    effect(() => {
      const summary = this.summary();
      const open = this.isOpen();
      untracked(() => {
        if (summary.preview.id !== this.shownId) {
          this.shownId = summary.preview.id;
          this.wasOpen = false;
          this.drop();
        }
        if (open) {
          this.wasOpen = true;
          if (this.loaded !== summary)
            void this.ensureDetails();
        }
        else if (this.wasOpen) {
          this.wasOpen = false;
          this.drop();
        }
      });
    });
  }

  protected choose(event: MouseEvent): void {
    if (Object.isNull((event.target as Element).closest(Resources.markdownLinkSelector)))
      this.chosen.emit();
  }

  protected openLink(opened: LinkOpenEvent): void {
    this.links.openLink(opened.url, opened.gesture);
  }

  protected openFile(target: string): void {
    this.links.openFile(target, this.message(), this.rootPath());
  }

  protected retry(): void {
    void this.ensureDetails();
  }

  private drop(): void {
    this.revision++;
    this.pending = null;
    this.loaded = null;
    this.details.set(null);
    this.loading.set(false);
    this.error.set(null);
  }

  private async readDetails(): Promise<boolean> {
    const revision = this.revision;
    this.loading.set(true);
    this.error.set(null);
    const taken: [string, ReadonlySet<number>][] = [];
    try {
      let summary = this.summary();
      let details = await this.readFrom(this.details(), summary.preview.id, taken);
      while (revision === this.revision && !Object.isNull(details) && summary !== this.summary()) {
        summary = this.summary();
        details = await this.readFrom(details, summary.preview.id, taken);
      }
      if (revision !== this.revision || Object.isNull(details))
        return false;
      this.details.set(details);
      this.loaded = summary;
      return true;
    }
    catch (error) {
      for (const [messageId, changed] of taken)
        this.history.restoreChanged(messageId, changed);
      if (revision === this.revision)
        this.error.set(error instanceof Error ? error.message : String(error));
      return false;
    }
    finally {
      if (revision === this.revision)
        this.loading.set(false);
    }
  }

  private async readFrom(held: Message | null, messageId: string, taken: [string, ReadonlySet<number>][]): Promise<Message | null> {
    const changed = this.history.takeChanged(messageId);
    taken.push([messageId, changed]);
    const last = held?.id === messageId ? held.details.at(-1) : undefined;
    if (Object.isNullOrUndefined(held) || Object.isUndefined(last) || changed.size > Resources.changedDetailsLimit)
      return await this.history.readDetails(messageId);
    const read = await this.history.readDetailsAfter(messageId, last.sequence, [...changed]);
    return Object.isNull(read) ? null : ReplyHistoryRowComponent.merge(held, last.sequence, read);
  }

  private static merge(held: Message, afterSequence: number, read: Message): Message {
    const fresh = new Map(read.details.map(t => [t.sequence, t]));
    return read.withDetails([...held.details.map(t => fresh.get(t.sequence) ?? t), ...read.details.filter(t => t.sequence > afterSequence)]);
  }
}
