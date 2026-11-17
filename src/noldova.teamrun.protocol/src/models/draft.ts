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

import { Resources } from "../resources.js";
import { MessageAttachment } from "./message-attachment.js";

export class Draft {
  public readonly chatId: string;
  public readonly text: string;
  public readonly attachments: readonly MessageAttachment[];
  public readonly missing: readonly string[];
  public readonly revision: number;
  public readonly updatedAt: string;

  public constructor(
    chatId: string, text: string, attachments: readonly MessageAttachment[], missing: readonly string[], revision: number, updatedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);
    if (!Number.isSafeInteger(revision) || revision < 1)
      throw new ArgumentException(Resources.draftRevisionInvalid, Resources.revisionField);
    for (const name of missing)
      ArgumentException.throwIfNullOrWhitespace(name, Resources.missingField);

    this.chatId = chatId;
    this.text = text;
    this.attachments = [...attachments];
    this.missing = [...missing];
    this.revision = revision;
    this.updatedAt = updatedAt;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): Draft {
    const reader = JsonReader.fromValue(value, path);
    return new Draft(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readString(Resources.textField),
      reader.readObjectArray(Resources.attachmentsField).map(t => MessageAttachment.fromJson(t.toJson(), t.path)),
      reader.readStringArray(Resources.missingField),
      reader.readInteger(Resources.revisionField),
      reader.readNonBlankString(Resources.updatedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.textField]: this.text,
      [Resources.attachmentsField]: this.attachments.map(t => t.toJson()),
      [Resources.missingField]: [...this.missing],
      [Resources.revisionField]: this.revision,
      [Resources.updatedAtField]: this.updatedAt
    };
  }
}
