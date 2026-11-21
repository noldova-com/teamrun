/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, DestroyRef, ElementRef, type InputSignal, type Signal, type WritableSignal, afterRenderEffect, computed, effect, inject, input, signal,
  untracked, viewChild
} from "@angular/core";
import {
  ButtonComponent, ButtonVariant, ClipboardWriter, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective,
  OverlayAlignment, OverlaySide, ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective
} from "@noldova/ui.components.angular";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { QualifiedName, type WebViewEvent, WebViewEventKind, WebViewPane } from "@noldova/desktop.protocol";
import { FileSaveOutcome, type IWebViewHandle, type IWindowPartContext, LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { Page, PageEventName, PageMethodName, PageRequest, type PageVersion, PageView } from "@noldova/teamrun.protocol";

import { PageSaveException } from "../../../exceptions/pages/page-save.exception";
import { PageDocumentResources } from "../../../services/pages/page-document-resources";
import { PageDocuments } from "../../../services/pages/page-documents";
import { PageKeys } from "../../../services/pages/page-keys";

@Component({
  selector: "nol-teamrun-page-document",
  imports: [ButtonComponent, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, ToolbarButtonComponent,
    ToolbarDirective, ToolbarItemDirective, TooltipDirective],
  templateUrl: "./page-document.component.html",
  styleUrl: "./page-document.component.css",
  host: {
    "(keydown)": "pressKey($event)"
  }
})
export class PageDocumentComponent {
  protected readonly resources: typeof PageDocumentResources = PageDocumentResources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly quiet: ButtonVariant = ButtonVariant.Text;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly end: OverlayAlignment = OverlayAlignment.End;
  protected readonly clipboard: ClipboardWriter | null = inject(ClipboardWriter, { optional: true });
  protected readonly platform: string = PageKeys.platformOf(navigator.platform);
  protected readonly isMac: boolean = this.platform === PageDocumentResources.macPlatform;
  protected readonly zoomInShortcut: string = PageDocumentResources.formatShortcut(PageDocumentResources.zoomInChord, this.isMac);
  protected readonly zoomOutShortcut: string = PageDocumentResources.formatShortcut(PageDocumentResources.zoomOutChord, this.isMac);
  protected readonly actualSizeShortcut: string = PageDocumentResources.formatShortcut(PageDocumentResources.actualSizeChord, this.isMac);
  protected readonly closeShortcut: string = PageDocumentResources.formatShortcut(PageDocumentResources.closeChord, this.isMac);
  protected readonly printTooltip: string = PageDocumentResources.formatPrintTooltip(PageDocumentResources.formatShortcut(PageDocumentResources.printChord, this.isMac));

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input<string>(String.empty);

  protected readonly view: WritableSignal<PageView | null> = signal(null);
  protected readonly isStopped: WritableSignal<boolean> = signal(false);
  protected readonly isUnopened: WritableSignal<boolean> = signal(false);
  protected readonly updatedBy: WritableSignal<Page | null> = signal(null);
  protected readonly failure: WritableSignal<string | null> = signal(null);
  protected readonly now: WritableSignal<number> = signal(Date.now());
  protected readonly isOffline: WritableSignal<boolean> = signal(!navigator.onLine);

  protected readonly isOlder: Signal<boolean> = computed(() => {
    const view = this.view();
    return !Object.isNull(view) && view.version !== view.page.version;
  });
  protected readonly name: Signal<string> = computed(() => this.view()?.page.title ?? this.title());
  protected readonly authors: Signal<string> = computed(() => {
    const view = this.view();
    if (Object.isNull(view))
      return String.empty;
    const shown = view.shown;
    const made = view.page.madeBy.name;
    const edited = shown.version === 1 || shown.editedBy.name === made ? null : shown.editedBy.name;
    return PageDocumentResources.formatAuthors(shown.version, made, edited, this.agoOf(shown.createdAt));
  });
  protected readonly isCovered: Signal<boolean> = computed(() => this.isStopped() || this.isUnopened());

  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly placeholder: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("placeholder");
  private readonly handle: WritableSignal<IWebViewHandle | null> = signal(null);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private loading: number = 0;
  private restored: number | null = null;
  private replaced: Page | null = null;
  private opening: Promise<void> | null = null;

  public constructor() {
    const releases: (() => void)[] = [];
    this.destroyRef.onDestroy(() => {
      for (const release of releases)
        release();
      const handle = this.handle();
      if (!Object.isNull(handle) && !handle.isClosed)
        handle.close();
    });
    releases.push(this.context.onEvent(PageDocumentResources.formatMethod(PageEventName.PageUpdated), t => this.onUpdated(t)));
    releases.push(this.context.onEvent(PageDocumentResources.formatMethod(PageEventName.PageShown), t => this.onUpdated(t)));
    releases.push(PageDocuments.onResync(this.context, () => void this.resyncAsync()));
    const onLine = (): void => this.isOffline.set(!navigator.onLine);
    window.addEventListener("online", onLine);
    window.addEventListener("offline", onLine);
    releases.push(() => {
      window.removeEventListener("online", onLine);
      window.removeEventListener("offline", onLine);
    });
    releases.push(this.context.onEvent(PageDocumentResources.formatMethod(PageEventName.PageStopped), t => {
      if (this.pageIdOf(t) === this.instance())
        this.isStopped.set(true);
    }));
    effect(() => {
      const instance = this.instance();
      untracked(() => void this.openOnceAsync(instance));
    });
    afterRenderEffect(onCleanup => {
      const handle = this.handle();
      if (Object.isNull(handle) || handle.isClosed || this.isCovered())
        return;
      handle.mount(this.placeholder().nativeElement);
      handle.show();
      onCleanup(() => {
        if (!handle.isClosed)
          handle.hide();
      });
    });
    effect(() => {
      const view = this.view();
      if (!Object.isNull(view))
        untracked(() => this.context.updateDocument(PageDocumentResources.documentName, this.instance(),
          { title: PageDocumentResources.formatTabTitle(view.page.title, view.version, !this.isOlder()) }));
    });
  }

  protected async reload(): Promise<void> {
    if (Object.isNull(this.handle()))
      await this.openOnceAsync(this.instance());
    else
      await this.loadAsync(null);
  }

  protected async openInBrowser(view: PageView): Promise<void> {
    await this.attempt(() => this.context.openLinkAsync(view.address, { place: LinkPlace.System }));
  }

  protected async save(view: PageView): Promise<void> {
    await this.attempt(async () => {
      const html = await this.requestAsync(PageMethodName.PageRead, view.version);
      if (typeof html !== "string")
        throw new PageSaveException(view.page.path);
      const outcome = await this.context.saveFileAsync(PageDocumentResources.formatFileName(view.page.path), new TextEncoder().encode(html));
      if (outcome === FileSaveOutcome.Failed)
        throw new PageSaveException(view.page.path);
    });
  }

  protected async copyPath(writer: ClipboardWriter, view: PageView): Promise<void> {
    if (!await writer.writeTextAsync(view.file))
      this.failure.set(PageDocumentResources.actionFailed);
  }

  protected async showInFolder(view: PageView): Promise<void> {
    await this.attempt(() => this.context.showInFolderAsync(view.file));
  }

  protected async zoom(change: number): Promise<void> {
    const handle = this.handle();
    if (!Object.isNull(handle))
      await this.attempt(async () => {
        if (change > 0)
          await handle.zoomInAsync();
        else if (change < 0)
          await handle.zoomOutAsync();
        else
          await handle.setZoomAsync(PageDocumentResources.actualZoom);
      });
  }

  protected close(): void {
    this.context.closeDocument(PageDocumentResources.documentName, this.instance());
  }

  protected async showVersion(version: PageVersion, view: PageView): Promise<void> {
    await this.loadAsync(version.version === view.page.version ? null : version.version);
  }

  protected async restore(view: PageView): Promise<void> {
    this.restored = null;
    await this.attempt(async () => {
      const page = Page.fromJson(await this.requestAsync(PageMethodName.PageRestore, view.version));
      this.restored = page.version;
      if (this.updatedBy()?.version === page.version)
        this.updatedBy.set(this.replaced);
      await this.loadAsync(null);
    });
  }

  protected versionRow(version: PageVersion): string {
    return PageDocumentResources.formatVersionRow(version.version, version.editedBy.name);
  }

  protected versionMeta(version: PageVersion, view: PageView): string {
    return PageDocumentResources.formatVersionMeta(this.agoOf(version.createdAt), version.version === view.page.version, version.version === 1);
  }

  protected olderText(view: PageView): string {
    return PageDocumentResources.formatOlder(view.version, view.shown.editedBy.name, view.page.version);
  }

  protected updatedText(page: Page): string {
    return PageDocumentResources.formatUpdated(page.editedBy.name, page.version, this.agoOf(page.updatedAt));
  }

  private openOnceAsync(instance: string): Promise<void> {
    this.opening ??= this.openAsync(instance).finally(() => {
      this.opening = null;
    });
    return this.opening;
  }

  private async openAsync(instance: string): Promise<void> {
    let handle: IWebViewHandle;
    try {
      handle = await this.context.webViews.openAsync(new WebViewPane(QualifiedName.parse(PageDocumentResources.documentName), instance),
        PageDocumentResources.profileKey);
    }
    catch {
      this.isUnopened.set(true);
      return;
    }
    if (this.destroyRef.destroyed) {
      handle.close();
      return;
    }
    const unsubscribe = handle.subscribe(t => this.onViewEvent(handle, t));
    this.destroyRef.onDestroy(unsubscribe);
    this.handle.set(handle);
    await this.loadAsync(null);
  }

  private async loadAsync(version: number | null, isInPlace: boolean = false): Promise<void> {
    const handle = this.handle();
    if (Object.isNull(handle))
      return;
    const previous = isInPlace && !this.isUnopened() ? this.view() : null;
    const load = ++this.loading;
    let view: PageView;
    try {
      view = PageView.fromJson(await this.requestAsync(PageMethodName.PageOpen, version));
    }
    catch {
      if (load === this.loading)
        this.isUnopened.set(true);
      return;
    }
    if (load !== this.loading || handle.isClosed)
      return;
    this.now.set(Date.now());
    this.view.set(view);
    this.isStopped.set(false);
    this.isUnopened.set(false);
    if (view.version !== view.page.version)
      this.updatedBy.set(null);
    const navigation = previous?.address === view.address ? handle.reloadAsync() : handle.navigateAsync(view.address);
    await navigation.catch(() => this.isUnopened.set(true));
  }

  private onViewEvent(handle: IWebViewHandle, event: WebViewEvent): void {
    switch (event.kind) {
      case WebViewEventKind.Crashed:
        this.isStopped.set(true);
        break;
      case WebViewEventKind.Closed:
        this.handle.set(null);
        this.isUnopened.set(true);
        break;
      case WebViewEventKind.State:
        this.keepInPlace(handle, event);
        break;
      case WebViewEventKind.Key:
        this.onKey(JsonReader.fromValue(event.details).readString("name"));
        break;
      default:
        break;
    }
  }

  protected pressKey(event: KeyboardEvent): void {
    if (event.isComposing || event.repeat)
      return;
    const name = PageKeys.find(event, this.platform);
    if (!Object.isNull(name)) {
      event.preventDefault();
      this.onKey(name);
    }
  }

  private onKey(name: string): void {
    const view = this.view();
    switch (name) {
      case PageDocumentResources.reloadKey:
        void this.reload();
        break;
      case PageDocumentResources.zoomInKey:
        void this.zoom(1);
        break;
      case PageDocumentResources.zoomOutKey:
        void this.zoom(-1);
        break;
      case PageDocumentResources.actualSizeKey:
        void this.zoom(0);
        break;
      case PageDocumentResources.printKey:
        if (!Object.isNull(view))
          void this.openInBrowser(view);
        break;
      default:
        break;
    }
  }

  private keepInPlace(handle: IWebViewHandle, event: WebViewEvent): void {
    const view = this.view();
    const address = JsonReader.fromValue(event.details).readString("address");
    if (!Object.isNull(view) && address !== String.empty && !PageDocumentResources.isSamePage(address, view.address))
      void handle.navigateAsync(view.address).catch(() => this.isUnopened.set(true));
  }

  private onUpdated(payload: unknown): void {
    let page: Page;
    try {
      page = Page.fromJson(payload);
    }
    catch {
      return;
    }
    if (page.id !== this.instance())
      return;
    if (page.version !== this.restored) {
      this.replaced = this.updatedBy();
      this.updatedBy.set(page);
    }
    void this.loadAsync(null, true);
  }

  private async resyncAsync(): Promise<void> {
    const before = this.view()?.page.version ?? Number.POSITIVE_INFINITY;
    if (Object.isNull(this.handle())) {
      await this.openOnceAsync(this.instance());
      return;
    }
    await this.loadAsync(null, true);
    const page = this.view()?.page;
    if (!Object.isUndefined(page) && page.version > before) {
      this.replaced = this.updatedBy();
      this.updatedBy.set(page);
    }
  }

  private pageIdOf(payload: unknown): string | null {
    try {
      return Page.fromJson(payload).id;
    }
    catch {
      return null;
    }
  }

  private requestAsync(method: PageMethodName, version: number | null): Promise<unknown> {
    return this.context.requestAsync(PageDocumentResources.formatMethod(method), new PageRequest(this.instance(), version).toJson());
  }

  private async attempt(action: () => Promise<void>): Promise<void> {
    this.failure.set(null);
    try {
      await action();
    }
    catch {
      this.failure.set(PageDocumentResources.actionFailed);
    }
  }

  private agoOf(at: string): string {
    return PageDocumentResources.formatAgo(Math.max(0, this.now() - Date.parse(at)));
  }
}
