/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { AttachmentInput, type MessageAttachment } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ComposerAttachment } from "./composer-attachment";

export class PickedAttachment extends ComposerAttachment {
  private readonly file: File;
  private savedFile: MessageAttachment | null;

  public constructor(file: File) {
    super(file.name, file.type || Resources.binaryMediaType, file.size);
    this.file = file;
    this.savedFile = null;
  }

  public override get isSaved(): boolean {
    return !Object.isNull(this.savedFile);
  }

  public override get sharedPath(): string | null {
    return null;
  }

  public override markSaved(file: MessageAttachment): void {
    this.savedFile = file;
  }

  public override async toInput(grant: (file: File) => Promise<string>): Promise<AttachmentInput> {
    if (!Object.isNull(this.savedFile))
      return new AttachmentInput(this.name, this.mediaType, null, this.savedFile.path);
    return new AttachmentInput(this.name, this.mediaType, null, null, await grant(this.file));
  }

  protected override readPreview(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(this.file);
    });
  }
}
