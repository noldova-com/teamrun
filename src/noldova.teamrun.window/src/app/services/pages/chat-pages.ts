/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type FactoryProvider, inject, type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FileSaveOutcome, type IWindowPartContext, LinkPlace, ViewBadge, WindowPartTokens } from "@noldova/desktop.window";
import { Page, PageKind, PageListRequest, PageRequest, PageView } from "@noldova/teamrun.protocol";

import { PagePathCopyException } from "../../exceptions/pages/page-path-copy.exception";
import { PageSaveException } from "../../exceptions/pages/page-save.exception";
import { ChatPagesResources } from "./chat-pages-resources";
import { PageDocumentResources } from "./page-document-resources";
import { PageDocuments } from "./page-documents";

export class ChatPages {
  public static readonly provider: FactoryProvider = { provide: ChatPages, useFactory: (): ChatPages => ChatPages.of(inject(WindowPartTokens.context)) };

  private static readonly stores: WeakMap<IWindowPartContext, ChatPages> = new WeakMap();
  private static readonly noChat: Signal<string | null> = signal(null);
  private static readonly noEditors: Signal<ReadonlyMap<string, string>> = signal(new Map());

  private readonly context: IWindowPartContext;
  private readonly pagesSignal: WritableSignal<ReadonlyMap<string, readonly Page[]>> = signal(new Map());
  private readonly loadErrorsSignal: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly openSignal: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly errorSignal: WritableSignal<string | null> = signal(null);
  private readonly chatSource: WritableSignal<Signal<string | null>> = signal(ChatPages.noChat);
  private readonly editorsSource: WritableSignal<Signal<ReadonlyMap<string, string>>> = signal(ChatPages.noEditors);
  private readonly loads: Set<string> = new Set();
  private readonly subscriptions: readonly (() => void)[];
  private openRead: number = 0;

  public readonly error: Signal<string | null> = this.errorSignal.asReadonly();
  public readonly chatId: Signal<string | null> = computed(() => this.chatSource()());

  public constructor(context: IWindowPartContext) {
    this.context = context;
    this.subscriptions = [
      context.onEvent(ChatPagesResources.shownName, t => this.markOpen(this.put(t))),
      context.onEvent(ChatPagesResources.updatedName, t => {
        if (!Object.isNull(this.put(t)))
          void this.readOpen();
      }),
      context.onDocumentClosed(PageDocumentResources.documentName, t => {
        this.openRead++;
        this.openSignal.update(u => ChatPages.without(u, t));
      })
    ];
    void this.readOpen();
  }

  public static of(context: IWindowPartContext): ChatPages {
    const found = ChatPages.stores.get(context);
    if (!Object.isUndefined(found))
      return found;
    const store = new ChatPages(context);
    ChatPages.stores.set(context, store);
    return store;
  }

  public static provide(context: IWindowPartContext, chatId: Signal<string | null>, follow: (watcher: (chatId: string | null) => void) => () => void,
    editors: Signal<ReadonlyMap<string, string>>): () => void {
    const store = ChatPages.of(context);
    store.chatSource.set(chatId);
    store.editorsSource.set(editors);
    const stop = follow(t => store.show(t));
    store.show(chatId());
    return () => {
      stop();
      ChatPages.release(context);
    };
  }

  public static release(context: IWindowPartContext): void {
    ChatPages.stores.get(context)?.dispose();
    ChatPages.stores.delete(context);
  }

  public watch(chatId: string): void {
    if (!this.loads.has(chatId))
      void this.load(chatId);
  }

  public retry(chatId: string): void {
    void this.load(chatId);
  }

  public pagesOf(chatId: string): readonly Page[] {
    return this.pagesSignal().get(chatId) ?? [];
  }

  public loadErrorOf(chatId: string): string | null {
    return this.loadErrorsSignal().get(chatId) ?? null;
  }

  public isLoaded(chatId: string): boolean {
    return this.pagesSignal().has(chatId) || this.loadErrorsSignal().has(chatId);
  }

  public find(chatId: string, pageId: string): Page | null {
    return this.pagesOf(chatId).find(t => t.id === pageId) ?? null;
  }

  public latest(page: Page): Page {
    const known = this.find(page.chatId, page.id);
    return Object.isNull(known) || known.version < page.version ? page : known;
  }

  public isOpen(pageId: string): boolean {
    return this.openSignal().has(pageId);
  }

  public editorOf(pageId: string): string | null {
    return this.editorsSource()().get(pageId) ?? null;
  }

  public open(page: Page): void {
    PageDocuments.open(this.context, page);
    this.markOpen(page);
  }

  public async openInBrowser(page: Page): Promise<void> {
    await this.attempt(async () => {
      const view = PageView.fromJson(await this.context.requestAsync(ChatPagesResources.openName, new PageRequest(page.id).toJson()));
      await this.context.openLinkAsync(view.address, { place: LinkPlace.System });
    }, ChatPagesResources.openFailed);
  }

  public async save(page: Page): Promise<void> {
    await this.attempt(async () => {
      const html = await this.context.requestAsync(ChatPagesResources.readName, new PageRequest(page.id).toJson());
      if (!Object.isString(html))
        throw new PageSaveException(page.path);
      const name = ChatPagesResources.fileNamePattern.exec(page.path)?.[0] ?? ChatPagesResources.fileNameFallback;
      if (await this.context.saveFileAsync(name, new TextEncoder().encode(html)) === FileSaveOutcome.Failed)
        throw new PageSaveException(page.path);
    }, ChatPagesResources.saveFailed);
  }

  public async copyPath(page: Page, write: (text: string) => Promise<boolean>): Promise<void> {
    await this.attempt(async () => {
      const view = PageView.fromJson(await this.context.requestAsync(ChatPagesResources.openName, new PageRequest(page.id).toJson()));
      if (!await write(view.file))
        throw new PagePathCopyException(page.path);
    }, ChatPagesResources.copyFailed);
  }

  private async attempt(action: () => Promise<void>, failure: string): Promise<void> {
    this.errorSignal.set(null);
    try {
      await action();
    }
    catch {
      this.errorSignal.set(failure);
    }
  }

  private async load(chatId: string): Promise<void> {
    this.loads.add(chatId);
    this.loadErrorsSignal.update(t => ChatPages.withoutKey(t, chatId));
    try {
      const value = await this.context.requestAsync(ChatPagesResources.listName, new PageListRequest(chatId).toJson());
      const listed = Array.isArray(value) ? value.map(t => Page.fromJson(t)).filter(t => t.kind === PageKind.Page) : [];
      this.pagesSignal.update(t => new Map(t).set(chatId, ChatPages.sorted(ChatPages.merged(listed, t.get(chatId) ?? []))));
      this.showBadge();
    }
    catch {
      this.loads.delete(chatId);
      this.loadErrorsSignal.update(t => new Map(t).set(chatId, ChatPagesResources.loadFailed));
    }
  }

  private put(value: JsonValue): Page | null {
    let page: Page;
    try {
      page = Page.fromJson(value);
    }
    catch {
      return null;
    }
    if (page.kind !== PageKind.Page)
      return null;
    this.pagesSignal.update(t => new Map(t).set(page.chatId, ChatPages.sorted(ChatPages.merged([page], t.get(page.chatId) ?? []))));
    this.showBadge();
    return page;
  }

  private markOpen(page: Page | null): void {
    if (Object.isNull(page))
      return;
    this.openRead++;
    this.openSignal.update(t => new Set([...t, page.id]));
  }

  private async readOpen(): Promise<void> {
    const read = ++this.openRead;
    try {
      const open = await this.context.listOpenDocumentsAsync(PageDocumentResources.documentName);
      if (read === this.openRead && !Object.isNull(open))
        this.openSignal.set(new Set(open));
    }
    catch {
      return;
    }
  }

  private show(chatId: string | null): void {
    if (!Object.isNull(chatId))
      this.watch(chatId);
    this.showBadge();
  }

  private showBadge(): void {
    const chatId = this.chatId();
    const count = Object.isNull(chatId) ? 0 : this.pagesOf(chatId).length;
    this.context.setViewBadge(ChatPagesResources.viewName, count === 0 ? null : new ViewBadge(count, ChatPagesResources.formatPageCount(count)));
  }

  private dispose(): void {
    for (const unsubscribe of this.subscriptions)
      unsubscribe();
  }

  private static merged(next: readonly Page[], known: readonly Page[]): readonly Page[] {
    const pages = new Map(known.map(t => [t.id, t]));
    for (const page of next) {
      const found = pages.get(page.id);
      if (Object.isUndefined(found) || found.version <= page.version)
        pages.set(page.id, page);
    }
    return [...pages.values()];
  }

  private static sorted(pages: readonly Page[]): readonly Page[] {
    return [...pages].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  private static without(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
    const next = new Set(set);
    next.delete(value);
    return next;
  }

  private static withoutKey(map: ReadonlyMap<string, string>, key: string): ReadonlyMap<string, string> {
    const next = new Map(map);
    next.delete(key);
    return next;
  }
}
