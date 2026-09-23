/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, type ElementRef, Injector, afterNextRender, afterRenderEffect,
  computed, effect, inject, input, signal, untracked, viewChild } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

import "@noldova/teamrun-foundation-core";
import { ReplyPanel } from "@noldova/teamrun-protocol";

import { HeightLedger } from "../../models/height-ledger";
import { VirtualRange } from "../../models/virtual-range";
import { Resources } from "../../resources";
import { ChatStore } from "../../services/chat-store.service";
import { ReplyHistory } from "../../services/reply-history.service";
import { ReplyHistoryRowComponent } from "../reply-history-row/reply-history-row.component";

@Component({
  selector: "tr-reply-history",
  imports: [MatIconModule, ReplyHistoryRowComponent],
  providers: [ReplyHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "relative block h-full min-h-0" },
  templateUrl: "./reply-history.component.html"
})
export class ReplyHistoryComponent {
  private readonly chat = inject(ChatStore);
  private readonly detector = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private readonly destroy = inject(DestroyRef);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>("scroller");
  private readonly content = viewChild.required<ElementRef<HTMLElement>>("content");
  private readonly measured = new Map<string, number>();
  private readonly observed = new Set<Element>();
  private ledger = new HeightLedger([], this.measured, Resources.messageHeightEstimate);
  private observer: ResizeObserver | null = null;
  private conversationId: string | null = null;

  protected readonly history = inject(ReplyHistory);
  protected readonly resources = Resources;
  protected readonly height = signal(0);
  protected readonly range = signal(VirtualRange.empty);
  protected readonly away = signal(false);
  protected readonly shown = computed(() => this.history.index().slice(this.range().start, this.range().end));
  protected readonly itemsById = computed(() => new Map(this.history.items().map(t => [t.summary.preview.id, t])));
  protected readonly emptyText = computed(() => this.panel() === ReplyPanel.Activity ? Resources.noActivityText : Resources.noChangesText);

  public readonly panel = input.required<ReplyPanel>();

  public constructor() {
    effect(() => {
      const id = this.chat.selectedConversationId();
      const panel = this.panel();
      untracked(() => {
        this.conversationId = id;
        this.measured.clear();
        this.ledger = new HeightLedger([], this.measured, Resources.messageHeightEstimate);
        this.away.set(false);
        this.scroller().nativeElement.scrollTop = 0;
        this.history.select(id, panel);
      });
    });
    effect(() => {
      this.history.items();
      this.history.index();
      untracked(() => {
        const top = this.rebuild();
        this.updateRange(top);
        const conversation = this.conversationId;
        afterNextRender(() => {
          if (!this.destroy.destroyed && conversation === this.conversationId) {
            this.scroller().nativeElement.scrollTop = top;
            this.observe();
          }
        }, { injector: this.injector });
      });
    });
    afterNextRender(() => {
      if (typeof ResizeObserver !== "undefined") {
        this.observer = new ResizeObserver(entries => this.measure(entries));
        this.observer.observe(this.scroller().nativeElement);
        this.observe();
      }
    });
    afterRenderEffect(() => {
      this.shown();
      this.history.items();
      this.history.loading();
      this.history.error();
      untracked(() => {
        this.observe();
        this.ensureLoadedRange();
      });
    });
    this.destroy.onDestroy(() => this.observer?.disconnect());
  }

  private observe(): void {
    if (Object.isNull(this.observer))
      return;
    const rows = new Set(this.content().nativeElement.querySelectorAll(Resources.replyHistoryRowSelector));
    for (const element of this.observed)
      if (!rows.has(element)) {
        this.observer.unobserve(element);
        this.observed.delete(element);
      }
    for (const element of rows)
      if (!this.observed.has(element)) {
        this.observer.observe(element);
        this.observed.add(element);
      }
  }

  private rebuild(): number {
    const top = this.scroller().nativeElement.scrollTop;
    const id = this.ledger.ids[this.ledger.indexAt(top)];
    const distance = Object.isUndefined(id) ? 0 : top - (this.ledger.offsetOf(id) ?? 0);
    const ids = this.history.index().map(t => t.id);
    const kept = new Set(ids);
    for (const measured of this.measured.keys())
      if (!kept.has(measured))
        this.measured.delete(measured);
    this.ledger = new HeightLedger(ids, this.measured, Resources.messageHeightEstimate);
    const offset = Object.isUndefined(id) ? null : this.ledger.offsetOf(id);
    return this.away() && !Object.isNull(offset) ? offset + distance : 0;
  }

  private updateRange(top: number): void {
    const next = this.ledger.rangeFor(top, this.scroller().nativeElement.clientHeight, Resources.windowMargin);
    this.height.set(this.ledger.total);
    if (!next.equals(this.range()))
      this.range.set(next);
  }

  private measure(entries: readonly ResizeObserverEntry[]): void {
    if (this.destroy.destroyed)
      return;
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset[Resources.messageIdDataKey];
      const height = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      if (!Object.isUndefined(id) && height > 0)
        this.measured.set(id, height);
    }
    const top = this.rebuild();
    this.updateRange(top);
    this.detector.detectChanges();
    this.scroller().nativeElement.scrollTop = top;
    this.observe();
  }

  protected onScroll(): void {
    const element = this.scroller().nativeElement;
    this.away.set(element.scrollTop > 0);
    const entry = this.history.index()[this.ledger.indexAt(element.scrollTop)];
    this.history.anchorSequence = this.away() ? entry?.sequence ?? null : null;
    this.updateRange(element.scrollTop);
    this.ensureLoadedRange();
  }

  protected heightOf(id: string): number {
    return this.ledger.heightOf(id) ?? Resources.messageHeightEstimate;
  }

  private ensureLoadedRange(): void {
    if (this.destroy.destroyed || this.history.loading() || this.history.error())
      return;
    const element = this.scroller().nativeElement;
    const index = this.history.index();
    const items = this.itemsById();
    const atTop = this.ledger.indexAt(element.scrollTop);
    const atBottom = this.ledger.indexAt(element.scrollTop + element.clientHeight);
    const missing = index.slice(atTop, atBottom + 1).find(t => !items.has(t.id)) ?? this.shown().find(t => !items.has(t.id));
    if (!Object.isUndefined(missing)) {
      const loaded = this.history.items();
      const firstIndex = index.findIndex(t => t.id === loaded[0]?.summary.preview.id);
      const lastIndex = index.findIndex(t => t.id === loaded.at(-1)?.summary.preview.id);
      const target = index.indexOf(missing);
      if (target < firstIndex && firstIndex - target <= Resources.messagePageSize)
        void this.history.loadNewer();
      else if (target > lastIndex && target - lastIndex <= Resources.messagePageSize)
        void this.history.loadOlder();
      else
        void this.history.loadAt(missing.sequence);
      return;
    }
    if (element.scrollTop < Resources.loadPageThreshold && this.history.hasLater())
      void this.history.loadNewer();
    else if (element.clientHeight > 0 && element.scrollHeight - element.scrollTop - element.clientHeight < Resources.loadPageThreshold)
      void this.history.loadOlder();
  }

  protected async loadNewest(): Promise<void> {
    this.away.set(false);
    this.history.anchorSequence = null;
    await this.history.loadNewest();
    if (!this.destroy.destroyed) {
      this.updateRange(0);
      this.scroller().nativeElement.scrollTop = 0;
    }
  }
}
