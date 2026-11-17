/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DetailKind, type Message, type MessageAttachment } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class RewoundDraft {
  public readonly conversationId: string;
  public readonly text: string;
  public readonly attachments: readonly MessageAttachment[];

  public constructor(conversationId: string, text: string, attachments: readonly MessageAttachment[]) {
    this.conversationId = conversationId;
    this.text = text;
    this.attachments = attachments;
  }

  public static of(message: Message): RewoundDraft {
    const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.paragraphSeparator);
    return new RewoundDraft(message.conversationId, text, message.attachments);
  }
}
