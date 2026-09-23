/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DraftAttachment } from "./draft-attachment";

export class ComposerDraft {
  public readonly conversationId: string;
  public readonly text: string;
  public readonly attachments: readonly DraftAttachment[];

  public constructor(conversationId: string, text: string, attachments: readonly DraftAttachment[]) {
    this.conversationId = conversationId;
    this.text = text;
    this.attachments = [...attachments];
  }
}
