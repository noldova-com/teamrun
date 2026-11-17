/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class SharedMcpUnavailability {
  public readonly providerId: string;
  public readonly reason: string;
  public readonly short: string | null;

  public constructor(providerId: string, reason: string, short: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(providerId, Resources.providerIdField);
    ArgumentException.throwIfNullOrWhitespace(reason, Resources.reasonField);
    if (!Object.isNull(short))
      ArgumentException.throwIfNullOrWhitespace(short, Resources.shortField);

    this.providerId = providerId;
    this.reason = reason;
    this.short = short;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpUnavailability {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpUnavailability(reader.readNonBlankString(Resources.providerIdField), reader.readNonBlankString(Resources.reasonField),
      reader.hasField(Resources.shortField) ? reader.readNullableString(Resources.shortField) : null);
  }

  public toJson(): JsonObject {
    return { [Resources.providerIdField]: this.providerId, [Resources.reasonField]: this.reason, [Resources.shortField]: this.short };
  }
}
