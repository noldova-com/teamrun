/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type AttachmentInput, DraftSaveParams } from "@noldova/teamrun.protocol";

import type { ComposerAttachment } from "./composer-attachment";

export class ComposerDraft {
  public readonly conversationId: string;
  public readonly text: string;
  public readonly attachments: readonly ComposerAttachment[];

  public constructor(conversationId: string, text: string, attachments: readonly ComposerAttachment[]) {
    this.conversationId = conversationId;
    this.text = text;
    this.attachments = [...attachments];
  }

  public get isEmpty(): boolean {
    return String.isNullOrWhitespace(this.text) && this.attachments.length === 0;
  }

  public async toParams(input: (attachment: ComposerAttachment) => Promise<AttachmentInput>): Promise<DraftSaveParams> {
    const inputs: AttachmentInput[] = [];
    for (const attachment of this.attachments)
      inputs.push(await input(attachment));
    return new DraftSaveParams(this.conversationId, this.text, inputs);
  }
}
