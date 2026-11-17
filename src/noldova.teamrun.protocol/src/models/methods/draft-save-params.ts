/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { AttachmentInput } from "../attachment-input.js";
import { Resources } from "../../resources.js";

export class DraftSaveParams {
  public readonly chatId: string;
  public readonly text: string;
  public readonly attachments: readonly AttachmentInput[];

  public constructor(chatId: string, text: string, attachments: readonly AttachmentInput[] = []) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (attachments.length > Resources.maximumAttachments)
      throw new ArgumentException(Resources.draftAttachmentsTooMany, Resources.attachmentsField);

    this.chatId = chatId;
    this.text = text;
    this.attachments = [...attachments];
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): DraftSaveParams {
    const reader = JsonReader.fromValue(value, path);
    return new DraftSaveParams(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readString(Resources.textField),
      reader.readObjectArray(Resources.attachmentsField).map(t => AttachmentInput.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.textField]: this.text,
      [Resources.attachmentsField]: this.attachments.map(t => t.toJson())
    };
  }
}
