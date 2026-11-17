/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, ElementRef, inject, input, type InputSignal, type Signal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { Page } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, SpinnerComponent, TooltipDirective } from "@noldova/ui.components.angular";

import { PageStep } from "../../../models/pages/page-step";
import { ChatPages } from "../../../services/pages/chat-pages";
import { ChatPagesResources } from "../../../services/pages/chat-pages-resources";
import { PagesClock } from "../../../services/pages/pages-clock";

@Component({
  selector: "nol-teamrun-page-card",
  imports: [ButtonComponent, SpinnerComponent, TooltipDirective],
  providers: [ChatPages.provider],
  host: { "role": "group", "[class.empty]": "current() === null", "[attr.aria-label]": "label()",
    "[attr.aria-current]": "isOpen() ? 'true' : null", "tabindex": "-1" },
  templateUrl: "./page-card.component.html",
  styleUrl: "./page-card.component.css"
})
export class PageCardComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly store: ChatPages = inject(ChatPages);
  private readonly now: Signal<number> = PagesClock.ticking();

  public readonly chatId: InputSignal<string> = input.required<string>();
  public readonly pageId: InputSignal<string> = input.required<string>();
  public readonly page: InputSignal<Page | null> = input<Page | null>(null);

  protected readonly resources: typeof ChatPagesResources = ChatPagesResources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly current: Signal<Page | null> = computed(() => {
    const page = this.page();
    return Object.isNull(page) ? this.store.find(this.chatId(), this.pageId()) : this.store.latest(page);
  });
  protected readonly isOpen: Signal<boolean> = computed(() => this.store.isOpen(this.pageId()));
  protected readonly editing: Signal<string | null> = computed(() => {
    const editor = this.store.editorOf(this.pageId());
    const page = this.current();
    return Object.isNull(editor) || Object.isNull(page) ? null : ChatPagesResources.formatEditing(editor, page.version);
  });
  protected readonly label: Signal<string | null> = computed(() => {
    const page = this.current();
    return Object.isNull(page) ? null : `${page.title}, ${this.editing() ?? this.metaOf(page)}`;
  });

  public constructor() {
    effect(() => this.store.watch(this.chatId()));
  }

  public static stepOf(payload: JsonValue, text: string, result: string | null): { readonly pageId: string; readonly page: Page | null } | null {
    const step = PageStep.of(payload, text, result);
    const pageId = step?.pageId ?? null;
    return Object.isNull(step) || Object.isNull(pageId) ? null : { pageId, page: step.page };
  }

  public static stepTitleOf(payload: JsonValue, text: string, result: string | null, isRunning: boolean, isFailed: boolean): string | null {
    return PageStep.of(payload, text, result)?.title(isRunning, isFailed) ?? null;
  }

  protected metaOf(page: Page): string {
    return ChatPagesResources.formatMeta(page.version, page.madeBy.name, page.editedBy.name, PagesClock.formatSince(page.updatedAt, this.now()), true);
  }

  protected openPage(page: Page): void {
    this.store.open(page);
    this.host.nativeElement.focus();
  }
}
