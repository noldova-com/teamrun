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

import { OrganizationRecipientState } from "../enums/organization-recipient-state.js";
import { Resources } from "../resources.js";

export class OrganizationRecipient {
  public readonly teammateId: string;
  public readonly teammateName: string;
  public readonly state: OrganizationRecipientState;
  public readonly chatId: string | null;
  public readonly messageId: string | null;
  public readonly reason: string | null;

  public constructor(
    teammateId: string,
    teammateName: string,
    state: OrganizationRecipientState,
    chatId: string | null = null,
    messageId: string | null = null,
    reason: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateName, Resources.teammateNameField);

    this.teammateId = teammateId;
    this.teammateName = teammateName;
    this.state = state;
    this.chatId = chatId;
    this.messageId = messageId;
    this.reason = reason;
  }

  public static fromJson(value: unknown, path?: string): OrganizationRecipient {
    const reader = JsonReader.fromValue(value, path);
    return new OrganizationRecipient(
      reader.readNonBlankString(Resources.teammateIdField),
      reader.readNonBlankString(Resources.teammateNameField),
      reader.readOneOf(Resources.stateField, Object.values(OrganizationRecipientState)),
      reader.readNullableString(Resources.chatIdField),
      reader.readNullableString(Resources.messageIdField),
      reader.readNullableString(Resources.reasonField));
  }

  public with(state: OrganizationRecipientState, chatId: string | null = this.chatId, messageId: string | null = this.messageId,
    reason: string | null = this.reason): OrganizationRecipient {
    return new OrganizationRecipient(this.teammateId, this.teammateName, state, chatId, messageId, reason);
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.teammateNameField]: this.teammateName,
      [Resources.stateField]: this.state,
      [Resources.chatIdField]: this.chatId,
      [Resources.messageIdField]: this.messageId,
      [Resources.reasonField]: this.reason
    };
  }
}
