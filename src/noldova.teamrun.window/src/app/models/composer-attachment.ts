/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { AttachmentInput, type MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import type { FileShare } from "./file-share";
import { ViewedImage } from "./viewed-image";

export class ComposerAttachment {
  private readonly file: File | null;
  private readonly preview: WritableSignal<string | null>;
  private savedFile: MessageAttachment | null;
  private share: FileShare | null = null;
  private disposed: boolean = false;

  public readonly key: string = crypto.randomUUID();
  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly previewUrl: Signal<string | null>;

  public constructor(source: File | MessageAttachment) {
    const isFile = source instanceof File;
    this.file = isFile ? source : null;
    this.savedFile = isFile ? null : source;
    this.name = source.name;
    this.mediaType = isFile ? source.type || Resources.binaryMediaType : source.mediaType;
    this.size = source.size;
    this.preview = signal(null);
    this.previewUrl = this.preview.asReadonly();
  }

  public get isImage(): boolean {
    return ProtocolResources.attachmentImageMediaTypes.includes(this.mediaType);
  }

  public get isSaved(): boolean {
    return !Object.isNull(this.savedFile);
  }

  public get sharedPath(): string | null {
    return Object.isNull(this.share) ? null : this.savedFile!.path;
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

  public markSaved(file: MessageAttachment): void {
    this.savedFile = file;
  }

  public async loadPreview(share: (path: string) => Promise<FileShare>): Promise<void> {
    if (!this.isImage)
      return;
    let url: string;
    try {
      url = Object.isNull(this.file) ? this.keep(await share(this.savedFile!.path)) : await ComposerAttachment.readDataUrl(this.file);
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

  public async toInput(grant: (file: File) => Promise<string>): Promise<AttachmentInput> {
    if (!Object.isNull(this.savedFile))
      return new AttachmentInput(this.name, this.mediaType, null, this.savedFile.path);
    return new AttachmentInput(this.name, this.mediaType, null, null, await grant(this.file!));
  }

  public dispose(): void {
    this.disposed = true;
    this.release();
    this.preview.set(null);
  }

  private keep(share: FileShare): string {
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
    return error instanceof DOMException || (error instanceof Error && typeof Reflect.get(error, Resources.errorCodeField) === "string");
  }

  private static readDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
