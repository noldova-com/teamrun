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

import { ChatWakeKind } from "../enums/chat-wake-kind.js";
import { ChatWakeState } from "../enums/chat-wake-state.js";
import { Resources } from "../resources.js";

export class ChatWake {
  public readonly id: string;
  public readonly kind: ChatWakeKind;
  public readonly chatId: string;
  public readonly sourceMessageId: string;
  public readonly watchedChatId: string;
  public readonly watchedIds: readonly string[];
  public readonly state: ChatWakeState;
  public readonly text: string | null;
  public readonly hop: number | null;
  public readonly createdAt: string;

  public constructor(id: string, kind: ChatWakeKind, chatId: string, sourceMessageId: string, watchedChatId: string, watchedIds: readonly string[],
    state: ChatWakeState, text: string | null, hop: number | null, createdAt: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idParameterName);
    ArgumentException.throwIfNullOrWhitespace(chatId, Resources.chatIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(sourceMessageId, Resources.sourceMessageIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(watchedChatId, Resources.watchedChatIdParameterName);
    if (watchedIds.length === 0)
      throw new ArgumentException(Resources.wakeWatchesNothing, Resources.watchedIdsParameterName);

    this.id = id;
    this.kind = kind;
    this.chatId = chatId;
    this.sourceMessageId = sourceMessageId;
    this.watchedChatId = watchedChatId;
    this.watchedIds = [...watchedIds];
    this.state = state;
    this.text = text;
    this.hop = hop;
    this.createdAt = createdAt;
  }

  public static fromJson(value: unknown): ChatWake {
    const reader = JsonReader.fromValue(value);
    return new ChatWake(
      reader.readNonBlankString(Resources.idColumn),
      reader.readOneOf(Resources.kindField, Object.values(ChatWakeKind)),
      reader.readNonBlankString(Resources.chatIdField),
      reader.readNonBlankString(Resources.sourceMessageIdField),
      reader.readNonBlankString(Resources.watchedChatIdField),
      reader.readStringArray(Resources.watchedIdsField),
      reader.readOneOf(Resources.stateField, Object.values(ChatWakeState)),
      reader.readNullableString(Resources.textField),
      reader.readNullableInteger(Resources.hopField),
      reader.readNonBlankString(Resources.createdAtField));
  }

  public settled(state: ChatWakeState, text: string, hop: number | null): ChatWake {
    return new ChatWake(this.id, this.kind, this.chatId, this.sourceMessageId, this.watchedChatId, this.watchedIds, state, text, hop, this.createdAt);
  }

  public toJson(): JsonObject {
    return {
      [Resources.idColumn]: this.id,
      [Resources.kindField]: this.kind,
      [Resources.chatIdField]: this.chatId,
      [Resources.sourceMessageIdField]: this.sourceMessageId,
      [Resources.watchedChatIdField]: this.watchedChatId,
      [Resources.watchedIdsField]: [...this.watchedIds],
      [Resources.stateField]: this.state,
      [Resources.textField]: this.text,
      [Resources.hopField]: this.hop,
      [Resources.createdAtField]: this.createdAt
    };
  }
}
