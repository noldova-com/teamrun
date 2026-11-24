/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AttachmentInput, type MessageAttachment } from "@noldova/teamrun.protocol";

import { ComposerAttachment } from "./composer-attachment";
import type { FileShare } from "./file-share";

export class SavedAttachment extends ComposerAttachment {
  private savedFile: MessageAttachment;

  public constructor(file: MessageAttachment) {
    super(file.name, file.mediaType, file.size);
    this.savedFile = file;
  }

  public override get isSaved(): boolean {
    return true;
  }

  public override get sharedPath(): string | null {
    return this.isShared ? this.savedFile.path : null;
  }

  public override markSaved(file: MessageAttachment): void {
    this.savedFile = file;
  }

  public override toInput(): Promise<AttachmentInput> {
    return Promise.resolve(new AttachmentInput(this.name, this.mediaType, null, this.savedFile.path));
  }

  protected override async readPreview(share: (path: string) => Promise<FileShare>): Promise<string> {
    return this.keep(await share(this.savedFile.path));
  }
}
