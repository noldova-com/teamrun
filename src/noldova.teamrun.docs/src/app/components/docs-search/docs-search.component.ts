/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, type Signal, type WritableSignal, computed, inject, signal, viewChild } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { TextFieldComponent } from "@noldova/ui.components.angular";

import "@noldova/context.core";

import { Resources } from "../../../resources";
import type { DocsPage } from "../../models/docs-page";
import { DocsSearchIndex } from "../../models/docs-search-index";

@Component({
  selector: "nol-docs-search",
  host: {
    "tabindex": "-1",
    "(focus)": "focusField()"
  },
  imports: [RouterLink, TextFieldComponent],
  templateUrl: "./docs-search.component.html",
  styleUrl: "./docs-search.component.css"
})
export class DocsSearchComponent {
  private static readonly NONE: number = -1;
  private static readonly OPTION_PREFIX: string = "nol-docs-search-option-";
  private static readonly DOWN: string = "ArrowDown";
  private static readonly UP: string = "ArrowUp";
  private static readonly ENTER: string = "Enter";
  private static readonly ESCAPE: string = "Escape";

  protected readonly resources: typeof Resources = Resources;
  protected readonly listId: string = "nol-docs-search-results";
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly isClosed: WritableSignal<boolean> = signal(false);
  protected readonly active: WritableSignal<number> = signal(DocsSearchComponent.NONE);
  protected readonly isOpen: Signal<boolean> = computed(() => !this.isClosed() && !String.isNullOrWhitespace(this.query()));
  protected readonly results: Signal<readonly DocsPage[]> = computed(() => DocsSearchIndex.search(this.query()));
  protected readonly activeId: Signal<string | null> = computed(() => this.isOpen() && this.active() !== DocsSearchComponent.NONE ? this.optionId(this.active()) : null);
  protected readonly field: Signal<ElementRef<HTMLInputElement>> = viewChild.required("searchInput", { read: ElementRef });
  private readonly list: Signal<ElementRef<HTMLUListElement> | undefined> = viewChild("resultsList", { read: ElementRef });
  private readonly router: Router = inject(Router);

  protected focusField(): void {
    this.field().nativeElement.focus();
  }

  protected optionId(index: number): string {
    return `${DocsSearchComponent.OPTION_PREFIX}${index}`;
  }

  protected type(text: string): void {
    this.query.set(text);
    this.isClosed.set(false);
    this.active.set(DocsSearchComponent.NONE);
  }

  protected press(event: KeyboardEvent): void {
    switch (event.key) {
      case DocsSearchComponent.DOWN:
        event.preventDefault();
        this.isClosed.set(false);
        this.move(Math.min(this.active() + 1, this.results().length - 1));
        break;
      case DocsSearchComponent.UP:
        event.preventDefault();
        if (this.active() !== DocsSearchComponent.NONE)
          this.move(Math.max(this.active() - 1, 0));
        break;
      case DocsSearchComponent.ENTER:
        this.open(event);
        break;
      case DocsSearchComponent.ESCAPE:
        event.preventDefault();
        if (this.isOpen())
          this.isClosed.set(true);
        else
          this.query.set(String.empty);
        this.active.set(DocsSearchComponent.NONE);
        break;
    }
  }

  protected clear(): void {
    this.query.set(String.empty);
    this.active.set(DocsSearchComponent.NONE);
  }

  private move(index: number): void {
    this.active.set(index);
    this.list()?.nativeElement.children.item(index)?.scrollIntoView({ block: "nearest" });
  }

  private open(event: KeyboardEvent): void {
    const page = this.isOpen() ? this.results().at(this.active()) : undefined;
    if (this.active() === DocsSearchComponent.NONE || Object.isUndefined(page))
      return;
    event.preventDefault();
    this.clear();
    void this.router.navigateByUrl(page.link);
  }
}
