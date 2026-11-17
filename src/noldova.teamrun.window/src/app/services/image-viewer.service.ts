/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FactoryProvider, InjectionToken, type Signal, type WritableSignal, inject, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FileSaveOutcome, type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import type { AttachmentContent } from "@noldova/teamrun.protocol";
import { ClipboardWriter } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { ImageOpenMode } from "../enums/image-open-mode";
import { ImageCopyException } from "../exceptions/image-copy.exception";
import type { IImageClipboard } from "../interfaces/i-image-clipboard";
import type { FileShare } from "../models/file-share";
import { ImageDimensions } from "../models/image-dimensions";
import { KeptImage } from "../models/kept-image";
import { KeptRead } from "../models/kept-read";
import { KeptSize } from "../models/kept-size";
import { ViewedImage } from "../models/viewed-image";
import { ChatStoreService } from "./chat-store.service";

export class ImageViewerService {
  public static readonly clipboard: InjectionToken<IImageClipboard | null> =
    new InjectionToken<IImageClipboard | null>(Resources.imageClipboardToken, { factory: () => inject(ClipboardWriter, { optional: true }) });
  public static readonly provider: FactoryProvider = {
    provide: ImageViewerService,
    useFactory: (): ImageViewerService => ImageViewerService.of(inject(WindowPartTokens.context), inject(ImageViewerService.clipboard))
  };

  private static readonly services: WeakMap<IWindowPartContext, ImageViewerService> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly store: ChatStoreService;
  private readonly clipboard: IImageClipboard | null;
  private readonly now: () => number;
  private readonly openModeSignal: WritableSignal<ImageOpenMode> = signal(ImageOpenMode.Popup);
  private readonly copyingSignal: WritableSignal<boolean> = signal(false);
  private readonly generated: Map<string, KeptImage> = new Map();
  private readonly sizes: Map<string, KeptSize> = new Map();
  private readonly reads: Map<string, KeptRead> = new Map();
  private readonly tabs: Map<string, Set<string>> = new Map();
  private readonly forgottenTabs: Set<string> = new Set();
  private readonly unwatch: () => void;
  private readonly unwatchDeletions: () => void;

  public readonly openMode: Signal<ImageOpenMode> = this.openModeSignal.asReadonly();
  public readonly copying: Signal<boolean> = this.copyingSignal.asReadonly();

  private constructor(context: IWindowPartContext, clipboard: IImageClipboard | null, now: () => number) {
    this.context = context;
    this.store = ChatStoreService.of(context);
    this.clipboard = clipboard;
    this.now = now;
    this.unwatch = context.onSettingChanged(Resources.imageOpenModeSetting, t => this.applyOpenMode(t));
    this.unwatchDeletions = this.store.onConversationDeleted(t => this.forget(t));
    this.applyOpenMode(context.readSetting(Resources.imageOpenModeSetting));
  }

  public get canCopy(): boolean {
    return !Object.isNull(this.clipboard);
  }

  public static of(context: IWindowPartContext, clipboard: IImageClipboard | null = null, now: () => number = () => performance.now()): ImageViewerService {
    const found = ImageViewerService.services.get(context);
    if (!Object.isUndefined(found))
      return found;
    const service = untracked(() => new ImageViewerService(context, clipboard, now));
    ImageViewerService.services.set(context, service);
    return service;
  }

  public static release(context: IWindowPartContext): void {
    const service = ImageViewerService.services.get(context);
    service?.unwatch();
    service?.unwatchDeletions();
    ImageViewerService.services.delete(context);
  }

  public static async decodeAsync(url: string): Promise<HTMLImageElement | null> {
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    }
    catch {
      return null;
    }
  }

  public static naturalSizeOf(element: HTMLImageElement): ImageDimensions {
    return ImageViewerService.viewBoxSizeOf(element.src) ?? (element.naturalWidth < 1 || element.naturalHeight < 1
      ? new ImageDimensions(Resources.fallbackImageWidth, Resources.fallbackImageHeight) : new ImageDimensions(element.naturalWidth, element.naturalHeight));
  }

  public openTab(image: ViewedImage): void {
    if (!Object.isNull(image.data)) {
      ImageViewerService.remember(this.generated, image.key, new KeptImage(image, ImageViewerService.byteLengthOf(image.data)),
        Resources.generatedImageLimit);
      ImageViewerService.bound(this.generated, t => t.bytes, 1);
    }
    const instance = image.toInstance();
    if (!Object.isNull(image.conversationId))
      this.tabs.set(image.conversationId, (this.tabs.get(image.conversationId) ?? new Set()).add(instance));
    this.context.openDocument(Resources.imageDocumentName, instance, image.name);
  }

  public forgetTab(instance: string): void {
    if (this.forgottenTabs.has(instance))
      return;
    this.forgottenTabs.add(instance);
    this.context.forgetDocument(Resources.imageDocumentName, instance);
  }

  public find(instance: string): ViewedImage | null {
    const image = ViewedImage.fromInstance(instance);
    if (Object.isNull(image) || !Object.isNull(image.path))
      return image;
    return this.generated.get(image.key)?.image ?? image;
  }

  public readAsync(image: ViewedImage): Promise<string | null> {
    if (!Object.isNull(image.data))
      return Promise.resolve(Resources.formatDataUrl(image.mediaType, image.data));
    return this.readOf(image)?.url ?? Promise.resolve(null);
  }

  public async loadAsync(image: ViewedImage): Promise<HTMLImageElement | null> {
    const read = Object.isNull(image.data) ? this.readOf(image) : null;
    if (Object.isNull(read))
      return ImageViewerService.decodeOrNullAsync(await this.readAsync(image));
    const [url, element] = await read.drawAsync(async t => [t, await ImageViewerService.decodeOrNullAsync(t)] as const);
    if (!Object.isNull(element) || Object.isNull(url) || !read.isShare)
      return element;
    read.release();
    if (!Object.isNull(image.messageId))
      return ImageViewerService.decodeOrNullAsync(await this.contentOfAsync(image));
    return await this.readOf(image)?.drawAsync(t => ImageViewerService.decodeOrNullAsync(t)) ?? null;
  }

  public async saveAsync(image: ViewedImage): Promise<boolean> {
    const url = await this.contentOfAsync(image);
    if (Object.isNull(url))
      return false;
    try {
      return await this.context.saveFileAsync(Resources.formatImageFileName(image.name, image.mediaType), ImageViewerService.bytesOf(url))
        !== FileSaveOutcome.Failed;
    }
    catch {
      return false;
    }
  }

  public async copyAsync(image: ViewedImage): Promise<boolean> {
    if (Object.isNull(this.clipboard) || this.copyingSignal())
      return false;
    this.copyingSignal.set(true);
    try {
      const url = await this.contentOfAsync(image);
      return !Object.isNull(url) && await this.clipboard.writeImageAsync(await ImageViewerService.pngOf(url));
    }
    catch {
      return false;
    }
    finally {
      this.copyingSignal.set(false);
    }
  }

  public sizeOf(key: string): ImageDimensions | null {
    return this.sizes.get(key)?.size ?? null;
  }

  public rememberSize(image: ViewedImage, element: HTMLImageElement): ImageDimensions {
    const size = ImageViewerService.naturalSizeOf(element);
    ImageViewerService.remember(this.sizes, image.key, new KeptSize(image.conversationId, size), Resources.imageSizeLimit);
    return size;
  }

  private readOf(image: ViewedImage): KeptRead | null {
    if (Object.isNull(image.path) || Object.isNull(image.conversationId))
      return null;
    const kept = this.reads.get(image.key);
    const read = Object.isUndefined(kept) || kept.hasExpired(this.now()) ? this.startRead(image, image.conversationId, image.path) : kept;
    if (read !== kept)
      kept?.release();
    ImageViewerService.remember(this.reads, image.key, read, Resources.imageReadLimit, t => t.release());
    return read;
  }

  private startRead(image: ViewedImage, conversationId: string, path: string): KeptRead {
    const read: KeptRead = new KeptRead(conversationId, this.shareAsync(image, conversationId, path).then(async share => {
      if (!Object.isNull(share))
        return read.keep(share, this.now() + Resources.imageShareLifetime);
      const content = Object.isNull(image.messageId) ? null : await this.fetchAsync(image, conversationId, path);
      const isKept = this.reads.get(image.key) === read;
      if (Object.isNull(content)) {
        if (isKept)
          this.reads.delete(image.key);
        return null;
      }
      if (isKept) {
        read.bytes = ImageViewerService.byteLengthOf(content.data);
        ImageViewerService.bound(this.reads, t => t.bytes, 0);
      }
      return Resources.formatDataUrl(content.mediaType, content.data);
    }));
    return read;
  }

  private async shareAsync(image: ViewedImage, conversationId: string, path: string): Promise<FileShare | null> {
    try {
      return Object.isNull(image.messageId) ? await this.store.shareAttachment(conversationId, path)
        : await this.store.shareWrittenImage(conversationId, image.messageId, path);
    }
    catch {
      return null;
    }
  }

  private async contentOfAsync(image: ViewedImage): Promise<string | null> {
    if (!Object.isNull(image.data) || Object.isNull(image.path) || Object.isNull(image.conversationId))
      return this.readAsync(image);
    const content = await this.fetchAsync(image, image.conversationId, image.path);
    return Object.isNull(content) ? null : Resources.formatDataUrl(content.mediaType, content.data);
  }

  private async fetchAsync(image: ViewedImage, conversationId: string, path: string): Promise<AttachmentContent | null> {
    try {
      return Object.isNull(image.messageId) ? await this.store.readAttachment(conversationId, path)
        : await this.store.readWrittenImage(conversationId, image.messageId, path);
    }
    catch {
      return null;
    }
  }

  private forget(conversationId: string): void {
    for (const [key, read] of [...this.reads])
      if (read.conversationId === conversationId) {
        this.reads.delete(key);
        read.release();
      }
    for (const [key, size] of [...this.sizes])
      if (size.conversationId === conversationId)
        this.sizes.delete(key);
    for (const [key, kept] of [...this.generated])
      if (kept.image.conversationId === conversationId)
        this.generated.delete(key);
    for (const instance of this.tabs.get(conversationId) ?? [])
      this.forgetTab(instance);
    this.tabs.delete(conversationId);
  }

  private applyOpenMode(value: JsonValue | undefined): void {
    this.openModeSignal.set(value === ImageOpenMode.Tab ? ImageOpenMode.Tab : ImageOpenMode.Popup);
  }

  private static decodeOrNullAsync(url: string | null): Promise<HTMLImageElement | null> {
    return Object.isNull(url) ? Promise.resolve(null) : ImageViewerService.decodeAsync(url);
  }

  private static remember<T>(entries: Map<string, T>, key: string, value: T, limit: number, drop: (entry: T) => void = () => undefined): void {
    entries.delete(key);
    entries.set(key, value);
    for (const [oldest, entry] of entries) {
      if (entries.size <= limit)
        return;
      entries.delete(oldest);
      drop(entry);
    }
  }

  private static bound<T>(entries: Map<string, T>, bytesOf: (entry: T) => number | null, newest: number): void {
    let total = [...entries.values()].reduce((t, u) => t + (bytesOf(u) ?? 0), 0);
    for (const [key, entry] of [...entries].slice(0, entries.size - newest)) {
      if (total <= Resources.imageByteLimit)
        break;
      const bytes = bytesOf(entry);
      if (Object.isNull(bytes))
        continue;
      total -= bytes;
      entries.delete(key);
    }
  }

  private static byteLengthOf(data: string): number {
    return Math.floor(data.replace(Resources.base64PaddingPattern, String.empty).length * 3 / 4);
  }

  private static viewBoxSizeOf(url: string): ImageDimensions | null {
    if (!url.startsWith(Resources.formatDataUrl(Resources.svgMediaType, String.empty)))
      return null;
    const root = new DOMParser().parseFromString(new TextDecoder().decode(ImageViewerService.bytesOf(url)), Resources.svgMediaType).documentElement;
    if (Resources.svgSizeAttributes.some(t => !(root.getAttribute(t)?.trim().endsWith(Resources.percentSuffix) ?? true)))
      return null;
    const [, , width, height] = (root.getAttribute(Resources.viewBoxAttribute) ?? String.empty).trim().split(Resources.viewBoxSeparatorPattern).map(Number);
    return width! > 0 && height! > 0 ? new ImageDimensions(width!, height!) : null;
  }

  private static bytesOf(url: string): Uint8Array {
    return Uint8Array.from(atob(url.slice(url.indexOf(Resources.dataUrlSeparator) + 1)), t => t.charCodeAt(0));
  }

  private static async pngOf(url: string): Promise<Uint8Array> {
    const image = await ImageViewerService.decodeAsync(url);
    if (!Object.isNull(image) && url.startsWith(Resources.formatDataUrl(Resources.clipboardImageMediaType, String.empty)))
      return ImageViewerService.bytesOf(url);
    const size = Object.isNull(image) ? null : ImageViewerService.naturalSizeOf(image);
    const context = Object.isNull(size) ? null : new OffscreenCanvas(size.width, size.height).getContext(Resources.canvasContext);
    if (Object.isNull(size) || Object.isNull(context))
      throw new ImageCopyException();
    context.drawImage(image!, 0, 0, size.width, size.height);
    const blob = await context.canvas.convertToBlob({ type: Resources.clipboardImageMediaType });
    return new Uint8Array(await blob.arrayBuffer());
  }
}
