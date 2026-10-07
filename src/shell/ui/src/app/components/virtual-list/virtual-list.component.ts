/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, type Signal, type WritableSignal, afterEveryRender, computed, contentChild, effect, inject, input, output,
  signal, untracked, viewChild, viewChildren
} from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { ButtonVariant } from "../../enums/button-variant";
import type { IVirtualListObserver } from "../../interfaces/i-virtual-list-observer";
import { VirtualListAnchor } from "../../models/virtual-list-anchor";
import { VirtualListGap } from "../../models/virtual-list-gap";
import { VirtualListRow } from "../../models/virtual-list-row";
import type { VirtualListSource } from "../../models/virtual-list-source";
import { VirtualListState } from "../../models/virtual-list-state";
import type { VirtualRange } from "../../models/virtual-range";
import { ButtonComponent } from "../button/button.component";
import { FieldMessageComponent } from "../field-message/field-message.component";
import { VirtualRowDirective } from "./virtual-row.directive";

@Component({
  selector: "tr-virtual-list",
  imports: [ButtonComponent, FieldMessageComponent, NgTemplateOutlet],
  templateUrl: "./virtual-list.component.html",
  styleUrl: "./virtual-list.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualListComponent<T> {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly viewport: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("viewport");
  private readonly slots: Signal<readonly ElementRef<HTMLElement>[]> = viewChildren<ElementRef<HTMLElement>>("slot");
  private readonly observer: ResizeObserver = new ResizeObserver(t => this.measure(t));
  private readonly observed: Set<Element> = new Set();
  private readonly follower: IVirtualListObserver = {
    onInserted: (at, count) => this.inserted(at, count),
    onRemoved: (at, count) => this.removed(at, count),
    onUpdated: () => undefined
  };
  private readonly layout: WritableSignal<number> = signal(0);
  private readonly scrollTop: WritableSignal<number> = signal(0);
  private readonly viewHeight: WritableSignal<number> = signal(0);
  private readonly focusIndex: WritableSignal<number | null> = signal(null);
  private anchor: VirtualListAnchor = new VirtualListAnchor(0, 0);
  private pendingTop: number | null = null;
  private isFocusPending: boolean = false;
  private hasFocus: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly rowTemplate: Signal<VirtualRowDirective<T>> = contentChild.required<VirtualRowDirective<T>>(VirtualRowDirective);
  protected readonly state: Signal<VirtualListState<T>> = computed(() => new VirtualListState(this.source(), t => this.failed.emit(t)));
  protected readonly range: Signal<VirtualRange> = computed(() => this.rangeFor(Resources.virtualListOverscan), { equal: (a, b) => a.equals(b) });
  protected readonly stop: Signal<number | null> = computed(() => {
    const { source, cache } = this.state();
    cache.revision();
    const count = source.length();
    const selected = this.selected();
    const found = Object.isNull(selected) ? -1 : cache.findIndex(t => source.keyOf(t) === selected);
    return count === 0 ? null : Math.min(this.focusIndex() ?? Math.max(0, found), count - 1);
  });
  protected readonly rows: Signal<readonly VirtualListRow<T>[]> = computed(() => {
    const { source, ledger, cache } = this.state();
    cache.revision();
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
      return new VirtualListRow(index, item, key, top, ledger.heightOf(index), index === stop, !Object.isUndefined(key) && key === selected);
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
  public readonly selected = input<string | null>(null);
  public readonly activated = output<T>();
  public readonly failed = output<unknown>();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.observer.disconnect());
    effect(onCleanup => {
      const state = this.state();
      state.source.observe(this.follower);
      untracked(() => this.reset());
      onCleanup(() => {
        state.cache.dispose();
        state.source.unobserve(this.follower);
      });
    });
    effect(() => {
      const wanted = this.rangeFor(Resources.virtualListOverscan + Resources.virtualListPrefetch);
      untracked(() => this.state().cache.request(wanted.start, wanted.end));
    });
    afterEveryRender({ write: () => this.settle() });
  }

  public focus(): void {
    const stop = this.stop();
    if (!Object.isNull(stop))
      this.moveTo(stop);
  }

  protected onScroll(): void {
    const top = this.viewport().nativeElement.scrollTop;
    this.anchor = this.state().ledger.anchorAt(top);
    this.scrollTop.set(top);
  }

  protected enter(event: FocusEvent): void {
    this.focusIndex.set(VirtualListComponent.indexOf(event));
    this.hasFocus = true;
  }

  protected leave(event: FocusEvent): void {
    if (this.host.contains(event.relatedTarget as Node | null))
      return;
    const target = event.target as Element;
    queueMicrotask(() => {
      this.hasFocus = !target.isConnected;
    });
  }

  protected press(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const from = VirtualListComponent.indexOf(event);
    if (event.key === Resources.enterKey || event.key === Resources.spaceKey) {
      event.preventDefault();
      this.choose(from);
      return;
    }
    const to = this.targetOf(event.key, from);
    if (Object.isNull(to))
      return;
    event.preventDefault();
    this.moveTo(Math.min(Math.max(0, to), this.state().source.length() - 1));
  }

  protected choose(index: number): void {
    const item = this.state().cache.itemAt(index);
    if (!Object.isUndefined(item))
      this.activated.emit(item);
  }

  protected retry(): void {
    this.state().cache.retry();
  }

  private static indexOf(event: Event): number {
    return Number(((event.target as Element).closest(Resources.virtualListRowSelector) as HTMLElement).dataset[Resources.virtualListRowKey]);
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
    this.anchor = new VirtualListAnchor(0, 0);
    this.focusIndex.set(null);
    this.scrollTo(0);
    this.layout.update(t => t + 1);
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

  private moveTo(index: number): void {
    const { ledger } = this.state();
    const top = ledger.offsetOf(index);
    const bottom = top + ledger.heightOf(index);
    const scrollTop = this.scrollTop();
    if (top < scrollTop)
      this.scrollTo(top);
    else if (bottom > scrollTop + this.viewHeight())
      this.scrollTo(bottom - this.viewHeight());
    this.focusIndex.set(index);
    this.isFocusPending = true;
    this.changeDetector.markForCheck();
  }

  private scrollTo(top: number): void {
    this.pendingTop = top;
    this.anchor = this.state().ledger.anchorAt(top);
    this.scrollTop.set(top);
  }

  private correct(): void {
    this.scrollTo(this.state().ledger.topOf(this.anchor));
    this.layout.update(t => t + 1);
  }

  private measure(entries: readonly ResizeObserverEntry[]): void {
    const { ledger, cache } = this.state();
    const viewport = this.viewport().nativeElement;
    const range = this.range();
    let isChanged = false;
    for (const { target } of entries) {
      if (target === viewport) {
        this.viewHeight.set(viewport.clientHeight);
        continue;
      }
      const index = Number((target as HTMLElement).dataset[Resources.virtualListRowKey]);
      if (index >= range.start && index < range.end && !Object.isUndefined(cache.itemAt(index)))
        isChanged = ledger.measure(index, target.getBoundingClientRect().height) || isChanged;
    }
    if (!isChanged)
      return;
    viewport.scrollTop = ledger.topOf(this.anchor);
    this.scrollTop.set(viewport.scrollTop);
    this.layout.update(t => t + 1);
  }

  private settle(): void {
    const viewport = this.viewport().nativeElement;
    this.observe([viewport, ...this.slots().map(t => t.nativeElement)]);
    if (!Object.isNull(this.pendingTop)) {
      viewport.scrollTop = this.pendingTop;
      this.pendingTop = null;
    }
    const focus = this.focusIndex();
    if (Object.isNull(focus) || !(this.isFocusPending || this.hasFocus && !this.host.contains(document.activeElement)))
      return;
    this.isFocusPending = false;
    (viewport.querySelector(Resources.formatVirtualListOptionSelector(focus)) as HTMLElement).focus({ preventScroll: true });
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
