/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../../resources.js";
import { AttachmentInput } from "../attachment-input.js";
import { RequestedSettings } from "../requested-settings.js";

export class MessageSendParams {
  public readonly conversationId: string;
  public readonly text: string;
  public readonly requested: RequestedSettings | null;
  public readonly providerAccountId: string | null;
  public readonly attachments: readonly AttachmentInput[];
  public readonly mentionedTeammateIds: readonly string[];
  public readonly responderTeammateId: string | null;

  public constructor(conversationId: string, text: string, requested: RequestedSettings | null, providerAccountId: string | null,
    attachments: readonly AttachmentInput[] = [], mentionedTeammateIds: readonly string[] = [], responderTeammateId: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    if (attachments.length === 0)
      ArgumentException.throwIfNullOrWhitespace(text, Resources.textField);
    if (!Object.isNull(providerAccountId))
      ArgumentException.throwIfNullOrWhitespace(providerAccountId, Resources.providerAccountIdField);
    for (const id of mentionedTeammateIds)
      ArgumentException.throwIfNullOrWhitespace(id, Resources.mentionedTeammateIdsField);
    if (!Object.isNull(responderTeammateId))
      ArgumentException.throwIfNullOrWhitespace(responderTeammateId, Resources.responderTeammateIdField);
    if (Object.isNull(requested) && mentionedTeammateIds.length === 0 && Object.isNull(responderTeammateId))
      throw new ArgumentException(Resources.defaultResponderSettingsRequired, Resources.requestedField);

    this.conversationId = conversationId;
    this.text = text;
    this.requested = requested;
    this.providerAccountId = providerAccountId;
    this.attachments = [...attachments];
    this.mentionedTeammateIds = [...mentionedTeammateIds];
    this.responderTeammateId = responderTeammateId;
  }

  public static fromJson(value: unknown, path?: string): MessageSendParams {
    const reader = JsonReader.fromValue(value, path);
    const requested = reader.readNullableObject(Resources.requestedField);
    return new MessageSendParams(
      reader.readNonBlankString(Resources.conversationIdField),
      reader.readString(Resources.textField),
      Object.isNull(requested) ? null : RequestedSettings.fromJson(requested.toJson(), requested.path),
      reader.readNullableString(Resources.providerAccountIdField),
      reader.hasField(Resources.attachmentsField)
        ? reader.readObjectArray(Resources.attachmentsField).map(t => AttachmentInput.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.mentionedTeammateIdsField) ? reader.readStringArray(Resources.mentionedTeammateIdsField) : [],
      reader.hasField(Resources.responderTeammateIdField) ? reader.readNullableString(Resources.responderTeammateIdField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.textField]: this.text,
      [Resources.requestedField]: Object.isNull(this.requested) ? null : this.requested.toJson(),
      [Resources.providerAccountIdField]: this.providerAccountId,
      [Resources.mentionedTeammateIdsField]: [...this.mentionedTeammateIds],
      [Resources.responderTeammateIdField]: this.responderTeammateId,
      ...(this.attachments.length === 0 ? {} : { [Resources.attachmentsField]: this.attachments.map(t => t.toJson()) })
    };
  }
}
