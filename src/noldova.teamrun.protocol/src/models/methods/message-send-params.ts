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

import { Resources } from "../../resources.js";
import { AttachmentInput } from "../attachment-input.js";
import { RequestedSettings } from "../requested-settings.js";

export class MessageSendParams {
  public readonly chatId: string;
  public readonly text: string;
  public readonly requested: RequestedSettings | null;
  public readonly providerId: string | null;
  public readonly attachments: readonly AttachmentInput[];
  public readonly mentionedTeammateIds: readonly string[];
  public readonly responderTeammateId: string | null;
  public readonly senderToken: string | null;
  public readonly wakeWhenDone: boolean;

  public constructor(chatId: string, text: string, requested: RequestedSettings | null, providerId: string | null,
    attachments: readonly AttachmentInput[] = [], mentionedTeammateIds: readonly string[] = [], responderTeammateId: string | null = null,
    senderToken: string | null = null, wakeWhenDone: boolean = false) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    if (attachments.length === 0)
      ArgumentException.throwIfNullOrWhitespace(text, Resources.textField);
    if (!Object.isNull(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    for (const id of mentionedTeammateIds)
      ArgumentException.throwIfNullOrWhitespace(id, Resources.mentionedTeammateIdsField);
    if (!Object.isNull(responderTeammateId))
      ArgumentException.throwIfNullOrWhitespace(responderTeammateId, Resources.responderTeammateIdField);
    if (!Object.isNull(senderToken))
      ArgumentException.throwIfNullOrWhitespace(senderToken, Resources.senderTokenField);
    if (Object.isNull(requested) && mentionedTeammateIds.length === 0 && Object.isNull(responderTeammateId) && Object.isNull(senderToken))
      throw new ArgumentException(Resources.defaultResponderSettingsRequired, Resources.requestedField);
    if (wakeWhenDone && Object.isNull(senderToken))
      throw new ArgumentException(Resources.wakeFromTokenOnly, Resources.wakeWhenDoneField);

    this.chatId = chatId;
    this.text = text;
    this.requested = requested;
    this.providerId = providerId;
    this.attachments = [...attachments];
    this.mentionedTeammateIds = [...mentionedTeammateIds];
    this.responderTeammateId = responderTeammateId;
    this.senderToken = senderToken;
    this.wakeWhenDone = wakeWhenDone;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): MessageSendParams {
    const reader = JsonReader.fromValue(value, path);
    if (reader.hasField(Resources.senderField))
      throw new ArgumentException(Resources.senderFromTokenOnly, Resources.senderField);
    const requested = reader.readNullableObject(Resources.requestedField);
    return new MessageSendParams(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readString(Resources.textField),
      Object.isNull(requested) ? null : RequestedSettings.fromJson(requested.toJson(), requested.path),
      reader.readNullableString(Resources.providerIdField),
      reader.hasField(Resources.attachmentsField)
        ? reader.readObjectArray(Resources.attachmentsField).map(t => AttachmentInput.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.mentionedTeammateIdsField) ? reader.readStringArray(Resources.mentionedTeammateIdsField) : [],
      reader.hasField(Resources.responderTeammateIdField) ? reader.readNullableString(Resources.responderTeammateIdField) : null,
      reader.hasField(Resources.senderTokenField) ? reader.readNonBlankString(Resources.senderTokenField) : null,
      reader.hasField(Resources.wakeWhenDoneField) ? reader.readBoolean(Resources.wakeWhenDoneField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.textField]: this.text,
      [Resources.requestedField]: Object.isNull(this.requested) ? null : this.requested.toJson(),
      [Resources.providerIdField]: this.providerId,
      [Resources.mentionedTeammateIdsField]: [...this.mentionedTeammateIds],
      [Resources.responderTeammateIdField]: this.responderTeammateId,
      ...(Object.isNull(this.senderToken) ? {} : { [Resources.senderTokenField]: this.senderToken }),
      ...(this.wakeWhenDone ? { [Resources.wakeWhenDoneField]: true } : {}),
      ...(this.attachments.length === 0 ? {} : { [Resources.attachmentsField]: this.attachments.map(t => t.toJson()) })
    };
  }
}
