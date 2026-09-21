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

import { Resources } from "../resources.js";

export class ConversationMember {
  public readonly conversationId: string;
  public readonly teammateId: string;
  public readonly joinedAt: string;
  public readonly nativeSessionId: string | null;
  public readonly resumedNativeSession: boolean;

  public constructor(
    conversationId: string,
    teammateId: string,
    joinedAt: string,
    nativeSessionId: string | null,
    resumedNativeSession: boolean) {
    ArgumentException.throwIfNullOrWhitespace(conversationId, Resources.conversationIdField);
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    ArgumentException.throwIfNullOrWhitespace(joinedAt, Resources.joinedAtField);
    if (!Object.isNull(nativeSessionId))
      ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdField);
    if (resumedNativeSession && Object.isNull(nativeSessionId))
      throw new ArgumentException(Resources.resumedWithoutSession, Resources.resumedNativeSessionField);

    this.conversationId = conversationId;
    this.teammateId = teammateId;
    this.joinedAt = joinedAt;
    this.nativeSessionId = nativeSessionId;
    this.resumedNativeSession = resumedNativeSession;
  }

  public static fromJson(value: unknown, path?: string): ConversationMember {
    const reader = JsonReader.fromValue(value, path);
    return new ConversationMember(
      reader.readNonBlankString(Resources.conversationIdField),
      reader.readNonBlankString(Resources.teammateIdField),
      reader.readNonBlankString(Resources.joinedAtField),
      reader.readNullableString(Resources.nativeSessionIdField),
      reader.readBoolean(Resources.resumedNativeSessionField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.conversationIdField]: this.conversationId,
      [Resources.teammateIdField]: this.teammateId,
      [Resources.joinedAtField]: this.joinedAt,
      [Resources.nativeSessionIdField]: this.nativeSessionId,
      [Resources.resumedNativeSessionField]: this.resumedNativeSession
    };
  }

  public withSession(nativeSessionId: string | null, resumedNativeSession: boolean): ConversationMember {
    return new ConversationMember(this.conversationId, this.teammateId, this.joinedAt, nativeSessionId, resumedNativeSession);
  }
}
