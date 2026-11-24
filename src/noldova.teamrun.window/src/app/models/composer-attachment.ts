/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { type AttachmentInput, type MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { FileShare } from "./file-share";
import { ViewedImage } from "./viewed-image";

export abstract class ComposerAttachment {
  private readonly preview: WritableSignal<string | null>;
  private share: FileShare | null = null;
  private disposed: boolean = false;

  public readonly key: string = crypto.randomUUID();
  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly previewUrl: Signal<string | null>;

  protected constructor(name: string, mediaType: string, size: number) {
    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
    this.preview = signal(null);
    this.previewUrl = this.preview.asReadonly();
  }

  public get isImage(): boolean {
    return ProtocolResources.attachmentImageMediaTypes.includes(this.mediaType);
  }

  public abstract get isSaved(): boolean;

  public abstract get sharedPath(): string | null;

  protected get isShared(): boolean {
    return !Object.isNull(this.share);
  }

  public viewedImageIn(conversationId: string): ViewedImage | null {
    const url = this.previewUrl();
    if (Object.isNull(url))
      return null;
    const path = this.sharedPath;
    return Object.isNull(path)
      ? ViewedImage.fromData(this.key, conversationId, this.name, this.mediaType, url.slice(url.indexOf(Resources.dataUrlSeparator) + 1))
      : new ViewedImage(this.key, conversationId, this.name, this.mediaType, path, null);
  }

  public abstract markSaved(file: MessageAttachment): void;

  public async loadPreview(share: (path: string) => Promise<FileShare>): Promise<void> {
    if (!this.isImage)
      return;
    let url: string;
    try {
      url = await this.readPreview(share);
    }
    catch (error) {
      if (ComposerAttachment.isReadFailure(error))
        return;
      throw error;
    }
    if (this.disposed)
      return;
    this.preview.set(url);
  }

  public previewFailed(): void {
    this.release();
    this.preview.set(null);
  }

  public abstract toInput(grant: (file: File) => Promise<string>): Promise<AttachmentInput>;

  public dispose(): void {
    this.disposed = true;
    this.release();
    this.preview.set(null);
  }

  protected abstract readPreview(share: (path: string) => Promise<FileShare>): Promise<string>;

  protected keep(share: FileShare): string {
    if (this.disposed)
      share.release();
    else
      this.share = share;
    return share.address;
  }

  private release(): void {
    this.share?.release();
    this.share = null;
  }

  private static isReadFailure(error: unknown): boolean {
    return error instanceof DOMException || error instanceof RuntimeRequestException;
  }
}
