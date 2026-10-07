/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, type ElementRef, type Signal, type WritableSignal, afterEveryRender, computed, contentChild, effect, inject, input, output,
  signal, untracked, viewChild, viewChildren
} from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { ButtonVariant } from "../../enums/button-variant";
import { VirtualListAlign } from "../../enums/virtual-list-align";
import { VirtualListKind } from "../../enums/virtual-list-kind";
import type { IVirtualListObserver } from "../../interfaces/i-virtual-list-observer";
import { VirtualListAnchor } from "../../models/virtual-list-anchor";
import { VirtualListChoice } from "../../models/virtual-list-choice";
import { VirtualListGap } from "../../models/virtual-list-gap";
import { VirtualListPosition } from "../../models/virtual-list-position";
import { VirtualListRow } from "../../models/virtual-list-row";
import type { VirtualListSource } from "../../models/virtual-list-source";
import { VirtualListState } from "../../models/virtual-list-state";
import type { VirtualRange } from "../../models/virtual-range";
import { ButtonComponent } from "../button/button.component";
import { FieldMessageComponent } from "../field-message/field-message.component";
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { TooltipDirective } from "../tooltip/tooltip.directive";
import { VirtualRowDirective } from "./virtual-row.directive";

@Component({
  selector: "tr-virtual-list",
  imports: [ButtonComponent, FieldMessageComponent, IconButtonComponent, NgTemplateOutlet, TooltipDirective],
  templateUrl: "./virtual-list.component.html",
  styleUrl: "./virtual-list.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualListComponent<T> {
  private static count: number = 0;

  private readonly id: string = `${Resources.virtualListIdPrefix}${VirtualListComponent.count++}`;
  private readonly document: Document = inject(DOCUMENT);
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);
  private readonly viewport: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("viewport");
  private readonly list: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("list");
  private readonly slots: Signal<readonly ElementRef<HTMLElement>[]> = viewChildren<ElementRef<HTMLElement>>("slot");
  private readonly observer: ResizeObserver = new ResizeObserver(t => this.measure(t));
  private readonly observed: Set<Element> = new Set();
  private readonly reserved: WeakSet<HTMLElement> = new WeakSet();
  private readonly follower: IVirtualListObserver = {
    onInserted: (at, count) => this.inserted(at, count),
    onRemoved: (at, count) => this.removed(at, count),
    onUpdated: () => undefined
  };
  private readonly layout: WritableSignal<number> = signal(0);
  private readonly scrollTop: WritableSignal<number> = signal(0);
  private readonly viewHeight: WritableSignal<number> = signal(0);
  private readonly focusIndex: WritableSignal<number | null> = signal(null);
  private readonly isFocused: WritableSignal<boolean> = signal(false);
  private readonly isFailing: Signal<boolean> = computed(() => this.gap()?.isFailed === true);
  private readonly isFocusWaiting: Signal<boolean> = computed(() => {
    const { cache } = this.state();
    cache.revision();
    const focus = this.focusIndex();
    return this.isFocused() && !Object.isNull(focus) && Object.isUndefined(cache.itemAt(focus)) && !cache.isFailed(focus);
  });
  private anchor: VirtualListAnchor = new VirtualListAnchor(0, 0);
  private endDistance: number = 0;
  private pendingTop: number | null = null;
  private domTop: number = 0;
  private isFocusPending: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly isFollowing: WritableSignal<boolean> = signal(false);
  protected readonly rowTemplate: Signal<VirtualRowDirective<T>> = contentChild.required<VirtualRowDirective<T>>(VirtualRowDirective);
  protected readonly isFeed: Signal<boolean> = computed(() => this.kind() === VirtualListKind.Feed);
  protected readonly state: Signal<VirtualListState<T>> = computed(() => {
    const source = this.source();
    return untracked(() => new VirtualListState(source, t => this.failed.emit(t)));
  });
  protected readonly range: Signal<VirtualRange> = computed(() => this.rangeFor(Resources.virtualListOverscan), { equal: (a, b) => a.equals(b) });
  protected readonly stop: Signal<number | null> = computed(() => {
    const count = this.state().source.length();
    const selected = this.isFeed() ? -1 : this.selected() ?? -1;
    const chosen = selected >= 0 && selected < count ? selected : 0;
    const fallback = this.isFeed() && this.isFollowing() ? count - 1 : chosen;
    return count === 0 ? null : Math.min(this.focusIndex() ?? fallback, count - 1);
  });
  protected readonly rows: Signal<readonly VirtualListRow<T>[]> = computed(() => {
    const { source, ledger, cache } = this.state();
    cache.revision();
    this.layout();
    const range = this.range();
    const stop = this.stop();
    const selected = this.selected();
    const indexes = Array.from({ length: range.end - range.start }, (_, t) => range.start + t);
    if (!Object.isNull(stop) && (stop < range.start || stop >= range.end))
      indexes.push(stop);
    return indexes.map(index => {
      const item = cache.itemAt(index);
      const key = Object.isUndefined(item) ? undefined : source.keyOf(item);
      const top = index < range.start || index >= range.end ? ledger.offsetOf(index) : null;
      return new VirtualListRow(this.id, index, item, key, top, ledger.heightOf(index), index === stop, index === selected);
    });
  });
  protected readonly gap: Signal<VirtualListGap | null> = computed(() => {
    const { cache } = this.state();
    cache.revision();
    const visible = this.rangeFor(0);
    let first: number | null = null;
    let isFailed = false;
    for (let index = visible.start; index < visible.end; index++)
      if (Object.isUndefined(cache.itemAt(index))) {
        first ??= index;
        isFailed ||= cache.isFailed(index);
      }
    return Object.isNull(first) ? null : new VirtualListGap(isFailed, first === visible.start);
  });

  public readonly source = input.required<VirtualListSource<T>>();
  public readonly label = input.required<string>();
  public readonly kind = input<VirtualListKind>(VirtualListKind.Options);
  public readonly selected = input<number | null>(null);
  public readonly position = input<VirtualListPosition | null>(null);
  public readonly activated = output<VirtualListChoice<T>>();
  public readonly positionChange = output<VirtualListPosition>();
  public readonly failed = output<unknown>();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.observer.disconnect());
    effect(onCleanup => {
      const state = this.state();
      state.cache.attach();
      state.source.observe(this.follower);
      untracked(() => this.reset());
      onCleanup(() => {
        state.cache.dispose();
        state.source.unobserve(this.follower);
      });
    });
    effect(() => {
      const wanted = this.rangeFor(Resources.virtualListOverscan + Resources.virtualListPrefetch);
      const focus = this.focusIndex();
      untracked(() => {
        const { cache } = this.state();
        cache.keep(focus);
        cache.request(wanted.start, wanted.end);
      });
    });
    effect(() => {
      this.state().cache.revision();
      untracked(() => this.resolve());
    });
    effect(() => {
      if (this.isFailing())
        void this.announcer.announce(Resources.virtualListFailed, Resources.assertiveAnnouncement);
    });
    effect(() => {
      if (this.isFocusWaiting())
        void this.announcer.announce(Resources.virtualListLoading, Resources.politeAnnouncement);
    });
    afterEveryRender({ write: () => this.settle() });
  }

  public focus(): void {
    const stop = this.stop();
    if (!Object.isNull(stop))
      this.moveTo(stop);
  }

  public reveal(index: number, align: VirtualListAlign): void {
    const count = this.state().source.length();
    if (count > 0)
      this.show(Math.min(Math.max(0, index), count - 1), align);
  }

  protected onScroll(): void {
    const viewport = this.viewport().nativeElement;
    const top = viewport.scrollTop;
    const moved = top - this.domTop;
    this.domTop = top;
    if (!Object.isNull(this.pendingTop)) {
      if (moved !== 0)
        this.scrollTo(this.pendingTop + moved);
      return;
    }
    if (Math.abs(top - this.scrollTop()) < 1)
      return;
    this.follow(viewport.scrollHeight - viewport.clientHeight - top);
    this.anchor = this.state().ledger.anchorAt(top);
    this.scrollTop.set(top);
    this.tell();
  }

  protected enter(index: number): void {
    this.focusIndex.set(index);
    this.isFocused.set(true);
  }

  protected leave(event: FocusEvent): void {
    if (event.relatedTarget instanceof Node && this.list().nativeElement.contains(event.relatedTarget))
      return;
    const { target } = event;
    queueMicrotask(() => {
      this.isFocused.set(target instanceof Node && !target.isConnected);
    });
  }

  protected press(event: KeyboardEvent, index: number): void {
    const from = this.focusIndex() ?? index;
    if (this.isFeed()) {
      this.pressInFeed(event, from);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (event.key === Resources.enterKey || event.key === Resources.spaceKey) {
      event.preventDefault();
      this.choose(from);
      return;
    }
    this.go(event, this.targetOf(event.key, from));
  }

  protected choose(index: number): void {
    const item = this.state().cache.itemAt(index);
    if (!this.isFeed() && !Object.isUndefined(item))
      this.activated.emit(new VirtualListChoice(index, item));
  }

  protected retry(): void {
    this.state().cache.retry();
  }

  protected jump(): void {
    this.endDistance = 0;
    this.isFollowing.set(true);
    this.scrollTo(this.targetTop());
    this.focusIndex.set(null);
    this.isFocusPending = true;
  }

  private pressInFeed(event: KeyboardEvent, from: number): void {
    if (event.altKey || event.metaKey || event.shiftKey)
      return;
    if (event.ctrlKey) {
      if (event.key === Resources.homeKey || event.key === Resources.endKey) {
        event.preventDefault();
        this.focusBeside(event.key === Resources.endKey);
      }
      return;
    }
    if (event.key === Resources.pageDownKey || event.key === Resources.pageUpKey)
      this.go(event, event.key === Resources.pageDownKey ? from + 1 : from - 1);
    else if (event.target === event.currentTarget)
      this.go(event, this.targetOf(event.key, from));
  }

  private go(event: KeyboardEvent, to: number | null): void {
    if (Object.isNull(to))
      return;
    event.preventDefault();
    this.moveTo(Math.min(Math.max(0, to), this.state().source.length() - 1));
  }

  private focusBeside(isAfter: boolean): void {
    const list = this.list().nativeElement;
    const tabbable = [...this.document.querySelectorAll<HTMLElement>(Resources.virtualListTabbableSelector)]
      .filter(t => t.tabIndex >= 0 && !list.contains(t) && !t.matches(":disabled") && t.checkVisibility({ visibilityProperty: true }));
    const target = isAfter
      ? tabbable.find(t => (list.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
      : tabbable.findLast(t => (list.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_PRECEDING) !== 0);
    target?.focus();
  }

  private inserted(at: number, count: number): void {
    this.state().ledger.insert(at, count);
    this.anchor = this.anchor.afterInsert(at, count);
    const focus = this.focusIndex();
    if (!Object.isNull(focus) && focus >= at)
      this.focusIndex.set(focus + count);
    this.correct();
  }

  private removed(at: number, count: number): void {
    const { source, ledger } = this.state();
    ledger.remove(at, count);
    this.anchor = this.anchor.afterRemove(at, count);
    const focus = this.focusIndex();
    const length = source.length();
    if (!Object.isNull(focus) && focus >= at)
      this.focusIndex.set(length === 0 ? null : Math.min(Math.max(at, focus - count), length - 1));
    this.correct();
  }

  private reset(): void {
    const { source, ledger } = this.state();
    const position = this.isFeed() ? this.position() : null;
    const anchor = Object.isNull(position)
      ? new VirtualListAnchor(0, 0)
      : new VirtualListAnchor(Math.min(Math.max(0, position.index), Math.max(0, source.length() - 1)), position.distance, position.key);
    this.isFollowing.set(this.isFeed() && Object.isNull(position));
    this.endDistance = 0;
    this.focusIndex.set(null);
    this.scrollTo(this.isFollowing() ? this.targetTop() : ledger.topOf(anchor));
    this.anchor = anchor;
    this.layout.update(t => t + 1);
  }

  private resolve(): void {
    const { source, cache } = this.state();
    if (Object.isNull(this.anchor.key) || Object.isUndefined(cache.itemAt(this.anchor.index)))
      return;
    const { index, distance } = this.anchor.resolve(t => cache.findIndex(item => source.keyOf(item) === t));
    const isMoved = index !== this.anchor.index;
    this.anchor = new VirtualListAnchor(index, distance);
    if (isMoved)
      this.correct();
  }

  private follow(distance: number): void {
    if (!this.isFeed())
      return;
    const { source, cache } = this.state();
    const isNear = distance <= Resources.virtualListFollowDistance;
    if (this.isFollowing() && !isNear)
      this.isFollowing.set(false);
    else if (!this.isFollowing() && isNear && !Object.isUndefined(cache.itemAt(source.length() - 1)))
      this.isFollowing.set(true);
    if (this.isFollowing())
      this.endDistance = Math.max(0, distance);
  }

  private tell(): void {
    const { source, cache } = this.state();
    const item = cache.itemAt(this.anchor.index);
    this.positionChange.emit(new VirtualListPosition(this.anchor.index, Object.isUndefined(item) ? null : source.keyOf(item), this.anchor.distance));
  }

  private rangeFor(margin: number): VirtualRange {
    this.layout();
    return this.state().ledger.rangeFor(this.scrollTop(), this.viewHeight(), margin);
  }

  private targetOf(key: string, from: number): number | null {
    const { source, ledger } = this.state();
    switch (key) {
      case Resources.arrowDownKey:
        return from + 1;
      case Resources.arrowUpKey:
        return from - 1;
      case Resources.homeKey:
        return 0;
      case Resources.endKey:
        return source.length() - 1;
      case Resources.pageDownKey:
        return ledger.indexAt(ledger.offsetOf(from) + this.viewHeight());
      case Resources.pageUpKey:
        return ledger.indexAt(Math.max(0, ledger.offsetOf(from) - this.viewHeight()));
      default:
        return null;
    }
  }

  private targetTop(): number {
    const { ledger } = this.state();
    return this.isFollowing() ? Math.max(0, ledger.total - this.viewHeight() - this.endDistance) : ledger.topOf(this.anchor);
  }

  private alignedTop(index: number, align: VirtualListAlign): number {
    const { ledger } = this.state();
    return Math.min(Math.max(0, this.wantedTop(index, align)), Math.max(0, ledger.total - this.viewHeight()));
  }

  private wantedTop(index: number, align: VirtualListAlign): number {
    const { ledger } = this.state();
    const top = ledger.offsetOf(index);
    const bottom = top + ledger.heightOf(index);
    const view = this.viewHeight();
    const scrollTop = this.scrollTop();
    switch (align) {
      case VirtualListAlign.Start:
        return top;
      case VirtualListAlign.Center:
        return (top + bottom - view) / 2;
      case VirtualListAlign.End:
        return bottom - view;
      default:
        return top < scrollTop ? top : Math.max(scrollTop, Math.min(top, bottom - view));
    }
  }

  private show(index: number, align: VirtualListAlign): void {
    const top = this.alignedTop(index, align);
    this.follow(this.state().ledger.total - this.viewHeight() - top);
    this.scrollTo(top);
  }

  private moveTo(index: number): void {
    this.show(index, VirtualListAlign.Nearest);
    this.focusIndex.set(index);
    this.isFocusPending = true;
  }

  private scrollTo(top: number): void {
    this.pendingTop = top;
    this.anchor = this.state().ledger.anchorAt(top);
    this.scrollTop.set(top);
  }

  private correct(): void {
    this.scrollTo(this.targetTop());
    this.layout.update(t => t + 1);
  }

  private measure(entries: readonly ResizeObserverEntry[]): void {
    const { ledger, cache } = this.state();
    const viewport = this.viewport().nativeElement;
    if (viewport.getClientRects().length === 0)
      return;
    let isChanged = false;
    for (const { target } of entries) {
      if (target === viewport) {
        this.viewHeight.set(viewport.clientHeight);
        isChanged = true;
        continue;
      }
      const index = Number(target.getAttribute(Resources.virtualListRowAttribute));
      if (!Object.isUndefined(cache.itemAt(index)))
        isChanged = ledger.measure(index, target.getBoundingClientRect().height) || isChanged;
    }
    if (!isChanged)
      return;
    const top = this.targetTop();
    viewport.scrollTop = top;
    this.domTop = viewport.scrollTop;
    this.pendingTop = top;
    this.scrollTop.set(top);
    this.layout.update(t => t + 1);
  }

  private settle(): void {
    const viewport = this.viewport().nativeElement;
    this.observe([viewport, ...this.slots().map(t => t.nativeElement)]);
    this.reserve();
    if (!Object.isNull(this.pendingTop)) {
      viewport.scrollTop = this.pendingTop;
      this.domTop = viewport.scrollTop;
      this.pendingTop = null;
    }
    const stop = this.stop();
    if (Object.isNull(stop))
      return;
    const row = viewport.querySelector<HTMLElement>(Resources.formatVirtualListRowSelector(stop));
    if (Object.isNull(row) || !(this.isFocusPending || this.isFocused() && !row.contains(this.document.activeElement)))
      return;
    this.isFocusPending = false;
    row.focus({ preventScroll: true });
  }

  private reserve(): void {
    const { ledger } = this.state();
    for (const { nativeElement: slot } of this.slots()) {
      const images = [...slot.querySelectorAll<HTMLImageElement>(Resources.virtualListImageSelector)].filter(t => !t.complete);
      if (images.length === 0 || this.reserved.has(slot))
        continue;
      this.reserved.add(slot);
      slot.style.minHeight = `${ledger.heightOf(Number(slot.getAttribute(Resources.virtualListRowAttribute)))}px`;
      void Promise.allSettled(images.map(t => t.decode())).then(() => {
        slot.style.minHeight = String.empty;
        this.reserved.delete(slot);
      });
    }
  }

  private observe(elements: readonly Element[]): void {
    const wanted = new Set(elements);
    for (const element of this.observed)
      if (!wanted.has(element)) {
        this.observer.unobserve(element);
        this.observed.delete(element);
      }
    for (const element of wanted)
      if (!this.observed.has(element)) {
        this.observer.observe(element);
        this.observed.add(element);
      }
  }
}
