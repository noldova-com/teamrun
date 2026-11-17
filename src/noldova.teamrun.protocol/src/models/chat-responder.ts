/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { RequestedSettings } from "./requested-settings.js";

export class ChatResponder {
  public readonly teammateId: string | null;
  public readonly requested: RequestedSettings | null;
  public readonly providerId: string | null;

  public constructor(teammateId: string | null, requested: RequestedSettings | null = null, providerId: string | null = null) {
    if (Object.isNull(teammateId) === Object.isNull(requested) || (!Object.isNull(teammateId) && !Object.isNull(providerId)))
      throw new ArgumentException(Resources.invalidChatResponder, Resources.responderField);
    if (!Object.isNull(teammateId))
      ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);
    if (!Object.isNull(providerId))
      ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);

    this.teammateId = teammateId;
    this.requested = requested;
    this.providerId = providerId;
  }

  public static fromJson(value: unknown, path?: string): ChatResponder {
    const reader = JsonReader.fromValue(value, path);
    const teammateId = reader.readNullableString(Resources.teammateIdField);
    const requested = reader.readNullableObject(Resources.requestedField);
    const providerId = reader.readNullableString(Resources.providerIdField);
    if (Object.isNull(teammateId) === Object.isNull(requested) || (!Object.isNull(teammateId) && !Object.isNull(providerId)))
      throw new JsonException(Resources.invalidChatResponder, reader.path);
    return new ChatResponder(teammateId, Object.isNull(requested) ? null : RequestedSettings.fromJson(requested.toJson(), requested.path),
      providerId);
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId,
      [Resources.requestedField]: Object.isNull(this.requested) ? null : this.requested.toJson(),
      [Resources.providerIdField]: this.providerId
    };
  }
}
