/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { AttachmentInput } from "../attachment-input.js";
import { Resources } from "../../resources.js";

export class DraftSaveParams {
  public readonly chatId: string;
  public readonly text: string;
  public readonly attachments: readonly AttachmentInput[];
  public readonly revision: number | null;

  public constructor(chatId: string, text: string, attachments: readonly AttachmentInput[] = [], revision: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (attachments.length > Resources.maximumAttachments)
      throw new ArgumentException(Resources.draftAttachmentsTooMany, Resources.attachmentsField);
    if (!Object.isNull(revision) && (!Number.isSafeInteger(revision) || revision < 0))
      throw new ArgumentException(Resources.draftBaseRevisionInvalid, Resources.revisionField);

    this.chatId = chatId;
    this.text = text;
    this.attachments = [...attachments];
    this.revision = revision;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): DraftSaveParams {
    const reader = JsonReader.fromValue(value, path);
    return new DraftSaveParams(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readString(Resources.textField),
      reader.readObjectArray(Resources.attachmentsField).map(t => AttachmentInput.fromJson(t.toJson(), t.path)),
      reader.hasField(Resources.revisionField) ? reader.readNullableInteger(Resources.revisionField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.textField]: this.text,
      [Resources.attachmentsField]: this.attachments.map(t => t.toJson()),
      [Resources.revisionField]: this.revision
    };
  }
}
