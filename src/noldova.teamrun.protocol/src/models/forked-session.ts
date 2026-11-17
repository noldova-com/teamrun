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

export class ForkedSession {
  public readonly kind: string;
  public readonly providerId: string | null;
  public readonly nativeSessionId: string;
  public readonly resumeAt: string | null;

  public constructor(kind: string, providerId: string | null, nativeSessionId: string, resumeAt: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);
    ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdField);
    if (!Object.isNull(resumeAt))
      ArgumentException.throwIfNullOrWhitespace(resumeAt, Resources.resumeAtField);

    this.kind = kind;
    this.providerId = providerId;
    this.nativeSessionId = nativeSessionId;
    this.resumeAt = resumeAt;
  }

  public static fromJson(value: unknown, path?: string): ForkedSession {
    const reader = JsonReader.fromValue(value, path);
    return new ForkedSession(
      reader.readNonBlankString(Resources.kindField),
      reader.readNullableString(Resources.providerIdField),
      reader.readNonBlankString(Resources.nativeSessionIdField),
      reader.hasField(Resources.resumeAtField) ? reader.readNullableString(Resources.resumeAtField) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      [Resources.providerIdField]: this.providerId,
      [Resources.nativeSessionIdField]: this.nativeSessionId,
      [Resources.resumeAtField]: this.resumeAt
    };
  }

  public matches(kind: string, providerId: string | null): boolean {
    return this.kind === kind && this.providerId === providerId;
  }
}
