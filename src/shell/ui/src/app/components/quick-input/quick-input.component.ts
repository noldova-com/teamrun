/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, computed, inject, input, linkedSignal, model,
  output, viewChild
} from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { QuickInputItem } from "../../models/quick-input-item";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-quick-input",
  templateUrl: "./quick-input.component.html",
  styleUrl: "./quick-input.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickInputComponent {
  private static count: number = 0;

  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly list: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("list");
  private readonly movedId: WritableSignal<string | null> = linkedSignal({
    source: () => ({ items: this.items(), query: this.query() }),
    computation: (source, previous?: { readonly source: { readonly items: readonly QuickInputItem[]; readonly query: string }; readonly value: string | null }) =>
      !Object.isUndefined(previous) && previous.source.query === source.query && source.items.some(t => t.id === previous.value) ? previous.value : null
  });
  private shownQuery: string = String.empty;
  private isChoosing: boolean = false;

  protected readonly listId: string = `${Resources.quickInputIdPrefix}${QuickInputComponent.count++}`;
  protected readonly active: Signal<number> = computed(() => {
    const id = this.movedId();
    return Math.max(0, this.items().findIndex(t => t.id === id));
  });
  protected readonly activeId: Signal<string | null> = computed(() => this.items().length === 0 ? null : this.optionId(this.active()));
  protected readonly status: Signal<string> = computed(() => Resources.formatResultCount(this.items().length));

  public readonly items = input.required<readonly QuickInputItem[]>();
  public readonly label = input.required<string>();
  public readonly query = model<string>(String.empty);
  public readonly isFocusing = input<boolean>(true);
  public readonly chosen = output<QuickInputItem>();
  public readonly dismissed = output<void>();

  public constructor() {
    afterRenderEffect(() => {
      this.shownQuery = this.query();
    });
    afterRenderEffect(() => {
      const list = this.list().nativeElement;
      const row = list.querySelector<HTMLElement>(`#${this.optionId(this.active())}`);
      if (!Object.isNull(row))
        QuickInputComponent.reveal(list, row);
    });
    afterNextRender(() => {
      if (this.isFocusing())
        this.host.querySelector<HTMLInputElement>(Resources.quickInputFieldSelector)?.focus();
    });
  }

  protected optionId(index: number): string {
    return `${this.listId}${Resources.quickInputOptionSeparator}${index}`;
  }

  protected onKey(event: KeyboardEvent): void {
    const next = QuickInputComponent.isModified(event) ? null : this.indexFor(event.key);
    if (!Object.isNull(next)) {
      event.preventDefault();
      this.movedId.set(this.items()[Math.max(0, Math.min(next, this.items().length - 1))]?.id ?? null);
      return;
    }
    if (event.key === Resources.enterKey) {
      event.preventDefault();
      this.chooseActive();
    }
    else if (event.key === Resources.escapeKey) {
      event.preventDefault();
      this.dismissed.emit();
    }
  }

  protected choose(index: number): void {
    const item = this.items()[index];
    if (!Object.isUndefined(item))
      this.chosen.emit(item);
  }

  private chooseActive(): void {
    if (this.query() === this.shownQuery)
      this.choose(this.active());
    else if (!this.isChoosing) {
      this.isChoosing = true;
      afterNextRender(() => {
        this.isChoosing = false;
        this.choose(this.active());
      }, { injector: this.injector });
    }
  }

  private indexFor(key: string): number | null {
    const active = this.active();
    switch (key) {
      case Resources.arrowDownKey:
        return active + 1;
      case Resources.arrowUpKey:
        return active - 1;
      case Resources.homeKey:
        return 0;
      case Resources.endKey:
        return this.items().length - 1;
      case Resources.pageDownKey:
        return active + this.pageSize();
      case Resources.pageUpKey:
        return active - this.pageSize();
      default:
        return null;
    }
  }

  private pageSize(): number {
    const list = this.list().nativeElement;
    const row = list.querySelector<HTMLElement>(Resources.quickInputOptionSelector);
    return Object.isNull(row) ? 1 : Math.max(1, Math.floor(list.clientHeight / row.offsetHeight));
  }

  private static isModified(event: KeyboardEvent): boolean {
    return event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
  }

  private static reveal(list: HTMLElement, row: HTMLElement): void {
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop + list.scrollTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop)
      list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }
}
