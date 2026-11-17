/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, effect, ElementRef, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { Page } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, ClipboardWriter, ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent,
  MenuSeparatorComponent, MenuTriggerDirective, TooltipDirective } from "@noldova/ui.components.angular";

import { ChatPages } from "../../../services/pages/chat-pages";
import { ChatPagesResources } from "../../../services/pages/chat-pages-resources";
import { PagesClock } from "../../../services/pages/pages-clock";
import { ContextMenuStateDirective } from "./context-menu-state.directive";

@Component({
  selector: "nol-teamrun-pages-view",
  imports: [ButtonComponent, ContextMenuStateDirective, ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent,
    MenuTriggerDirective, TooltipDirective],
  providers: [ChatPages.provider],
  templateUrl: "./pages-view.component.html",
  styleUrl: "./pages-view.component.css"
})
export class PagesViewComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly now: Signal<number> = PagesClock.ticking();

  protected readonly store: ChatPages = inject(ChatPages);
  protected readonly clipboard: ClipboardWriter | null = inject(ClipboardWriter, { optional: true });
  protected readonly resources: typeof ChatPagesResources = ChatPagesResources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly chatId: Signal<string | null> = this.store.chatId;
  protected readonly focused: WritableSignal<string | null> = signal(null);
  protected readonly menusOpen: WritableSignal<ReadonlySet<string>> = signal(new Set());

  public constructor() {
    effect(() => {
      const chatId = this.chatId();
      if (!Object.isNull(chatId))
        this.store.watch(chatId);
    });
  }

  public static provide(context: IWindowPartContext, chatId: Signal<string | null>, follow: (watcher: (chatId: string | null) => void) => () => void,
    editors: Signal<ReadonlyMap<string, string>>): () => void {
    return ChatPages.provide(context, chatId, follow, editors);
  }

  protected metaOf(page: Page): string {
    return ChatPagesResources.formatMeta(page.version, page.madeBy.name, page.editedBy.name, PagesClock.formatSince(page.updatedAt, this.now()), false);
  }

  protected labelOf(page: Page): string {
    return `${page.title}, ${this.metaOf(page)}`;
  }

  protected open(page: Page): void {
    this.store.open(page);
  }

  protected openInBrowser(page: Page): void {
    void this.store.openInBrowser(page);
  }

  protected save(page: Page): void {
    void this.store.save(page);
  }

  protected copyPath(page: Page, clipboard: ClipboardWriter): void {
    void this.store.copyPath(page, t => clipboard.writeTextAsync(t));
  }

  protected retry(chatId: string): void {
    this.store.retry(chatId);
  }

  protected openMenu(pageId: string): void {
    this.menusOpen.update(t => new Set([...t, pageId]));
  }

  protected closeMenu(pageId: string): void {
    this.menusOpen.update(t => new Set([...t].filter(u => u !== pageId)));
  }

  protected isStop(page: Page, pages: readonly Page[]): boolean {
    const focused = this.focused();
    return pages.some(t => t.id === focused) ? page.id === focused : page === pages[0];
  }

  protected move(event: KeyboardEvent, page: Page, pages: readonly Page[]): void {
    const index = pages.findIndex(t => t.id === page.id);
    const target = ChatPagesResources.rowKeys.get(event.key)?.(index, pages.length);
    const next = Object.isUndefined(target) ? undefined : pages[target];
    if (Object.isUndefined(next))
      return;
    event.preventDefault();
    this.focused.set(next.id);
    this.host.querySelector<HTMLElement>(`[data-nol-teamrun-page="${CSS.escape(next.id)}"]`)?.focus();
  }
}
