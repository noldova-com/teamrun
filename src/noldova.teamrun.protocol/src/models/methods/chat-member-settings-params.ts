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
import { ChatMemberSettings } from "../chat-member-settings.js";

export class ChatMemberSettingsParams {
  public readonly chatId: string;
  public readonly teammateId: string;
  public readonly settings: ChatMemberSettings | null;

  public constructor(chatId: string, teammateId: string, settings: ChatMemberSettings | null) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);

    this.chatId = chatId;
    this.teammateId = teammateId;
    this.settings = settings;
  }

  public static fromJson(value: unknown, path?: string): ChatMemberSettingsParams {
    const reader = JsonReader.fromValue(value, path);
    const settings = reader.readNullableObject(Resources.settingsField);
    return new ChatMemberSettingsParams(reader.readNonBlankString(Resources.chatIdField), reader.readNonBlankString(Resources.teammateIdField),
      Object.isNull(settings) ? null : ChatMemberSettings.fromJson(settings.toJson(), settings.path));
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.teammateIdField]: this.teammateId,
      [Resources.settingsField]: this.settings?.toJson() ?? null
    };
  }
}
