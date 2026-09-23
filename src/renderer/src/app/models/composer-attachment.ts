/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { AttachmentInput, MessageAttachment, Resources as ProtocolResources } from "@noldova/teamrun-protocol";

import { Resources } from "../resources";
import { ImageSource } from "./image-source";
import { DraftAttachment } from "./draft-attachment";

export class ComposerAttachment {
  private readonly file: File | null;
  private readonly savedPath: string | null;
  private readonly previewUrl: string | null;
  private readonly draftId: string;

  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly image: ImageSource | null;

  private constructor(name: string, mediaType: string, size: number, file: File | null, savedPath: string | null, draftId: string = crypto.randomUUID()) {
    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
    this.file = file;
    this.savedPath = savedPath;
    this.draftId = draftId;
    const isImage = ProtocolResources.attachmentImageMediaTypes.includes(mediaType);
    this.previewUrl = isImage && !Object.isNull(file) ? URL.createObjectURL(file) : null;
    this.image = isImage ? new ImageSource(name, name, savedPath, this.previewUrl, file) : null;
  }

  public static fromFile(file: File): ComposerAttachment {
    return new ComposerAttachment(file.name, file.type || Resources.binaryMediaType, file.size, file, null);
  }

  public static fromSaved(attachment: MessageAttachment): ComposerAttachment {
    return new ComposerAttachment(attachment.name, attachment.mediaType, attachment.size, null, attachment.path);
  }

  public static fromDraft(attachment: DraftAttachment): ComposerAttachment {
    const file = attachment.file;
    const saved = attachment.saved;
    if (!Object.isNull(file))
      return new ComposerAttachment(file.name, file.type || Resources.binaryMediaType, file.size, file, null, attachment.id);
    if (Object.isNull(saved))
      throw new Error(Resources.draftUnreadable);
    return new ComposerAttachment(saved.name, saved.mediaType, saved.size, null, saved.path, attachment.id);
  }

  public toDraft(): DraftAttachment {
    return new DraftAttachment(this.draftId, this.file, Object.isNull(this.savedPath) ? null
      : new MessageAttachment(this.name, this.mediaType, this.size, this.savedPath));
  }

  public async toInput(): Promise<AttachmentInput> {
    const file = this.file;
    if (Object.isNull(file))
      return new AttachmentInput(this.name, this.mediaType, null, this.savedPath);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (Object.isString(reader.result))
          resolve(reader.result.slice(reader.result.indexOf(Resources.dataUrlSeparator) + 1));
        else
          reject(new Error(Resources.attachmentReadFailed));
      };
      reader.onerror = () => reject(reader.error);
      reader.onabort = () => reject(new Error(Resources.attachmentReadFailed));
      reader.readAsDataURL(file);
    });
    return new AttachmentInput(this.name, this.mediaType, data, null);
  }

  public dispose(): void {
    if (!Object.isNull(this.previewUrl))
      URL.revokeObjectURL(this.previewUrl);
  }
}
