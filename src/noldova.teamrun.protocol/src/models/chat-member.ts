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
import { ChatMemberSettings } from "./chat-member-settings.js";

export class ChatMember {
  public readonly chatId: string;
  public readonly teammateId: string;
  public readonly joinedAt: string;
  public readonly nativeSessionId: string | null;
  public readonly resumedNativeSession: boolean;
  public readonly mode: string | null;
  public readonly settings: ChatMemberSettings | null;
  public readonly sessionProviderId: string | null;

  public constructor(
    chatId: string,
    teammateId: string,
    joinedAt: string,
    nativeSessionId: string | null,
    resumedNativeSession: boolean,
    mode: string | null = null,
    settings: ChatMemberSettings | null = null,
    sessionProviderId: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(joinedAt, Resources.joinedAtField);
    if (!Object.isNull(nativeSessionId))
      ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdField);
    if (resumedNativeSession && Object.isNull(nativeSessionId))
      throw new ArgumentException(Resources.resumedWithoutSession, Resources.resumedNativeSessionField);
    if (!Object.isNull(mode))
      ArgumentException.throwIfNullOrWhitespace(mode, Resources.modeField);
    if (!Object.isNull(sessionProviderId))
      ArgumentException.throwIfNullOrWhitespace(sessionProviderId, Resources.sessionProviderIdField);
    if (!Object.isNull(sessionProviderId) && Object.isNull(nativeSessionId))
      throw new ArgumentException(Resources.sessionProviderWithoutSession, Resources.sessionProviderIdField);

    this.chatId = chatId;
    this.teammateId = teammateId;
    this.joinedAt = joinedAt;
    this.nativeSessionId = nativeSessionId;
    this.resumedNativeSession = resumedNativeSession;
    this.mode = mode;
    this.settings = settings;
    this.sessionProviderId = sessionProviderId;
  }

  public get conversationId(): string {
    return this.chatId;
  }

  public static fromJson(value: unknown, path?: string): ChatMember {
    const reader = JsonReader.fromValue(value, path);
    return new ChatMember(
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.teammateIdField),
      reader.readNonBlankString(Resources.joinedAtField),
      reader.readNullableString(Resources.nativeSessionIdField),
      reader.readBoolean(Resources.resumedNativeSessionField),
      reader.hasField(Resources.modeField) ? reader.readNullableString(Resources.modeField) : null,
      ChatMember.readSettings(reader),
      reader.hasField(Resources.sessionProviderIdField) ? reader.readNullableString(Resources.sessionProviderIdField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.chatIdField]: this.chatId,
      [Resources.teammateIdField]: this.teammateId,
      [Resources.joinedAtField]: this.joinedAt,
      [Resources.nativeSessionIdField]: this.nativeSessionId,
      [Resources.resumedNativeSessionField]: this.resumedNativeSession,
      [Resources.modeField]: this.mode,
      [Resources.settingsField]: this.settings?.toJson() ?? null,
      [Resources.sessionProviderIdField]: this.sessionProviderId
    };
  }

  public withSession(nativeSessionId: string | null, resumedNativeSession: boolean, sessionProviderId: string | null = null): ChatMember {
    return new ChatMember(this.chatId, this.teammateId, this.joinedAt, nativeSessionId, resumedNativeSession, this.mode, this.settings, sessionProviderId);
  }

  public withMode(mode: string | null): ChatMember {
    return new ChatMember(this.chatId, this.teammateId, this.joinedAt, this.nativeSessionId, this.resumedNativeSession, mode, this.settings,
      this.sessionProviderId);
  }

  public withSettings(settings: ChatMemberSettings | null): ChatMember {
    return new ChatMember(this.chatId, this.teammateId, this.joinedAt, this.nativeSessionId, this.resumedNativeSession, this.mode, settings,
      this.sessionProviderId);
  }

  private static readSettings(reader: JsonReader): ChatMemberSettings | null {
    const settings = reader.hasField(Resources.settingsField) ? reader.readNullableObject(Resources.settingsField) : null;

    return Object.isNull(settings) ? null : ChatMemberSettings.fromJson(settings.toJson(), settings.path);
  }
}
