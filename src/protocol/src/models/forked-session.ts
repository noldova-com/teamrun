/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class ForkedSession {
  public readonly provider: string;
  public readonly providerAccountId: string | null;
  public readonly nativeSessionId: string;

  public constructor(provider: string, providerAccountId: string | null, nativeSessionId: string) {
    ArgumentException.throwIfNullOrWhitespace(provider, Resources.providerField);
    ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdField);

    this.provider = provider;
    this.providerAccountId = providerAccountId;
    this.nativeSessionId = nativeSessionId;
  }

  public static fromJson(value: unknown, path?: string): ForkedSession {
    const reader = JsonReader.fromValue(value, path);
    return new ForkedSession(
      reader.readNonBlankString(Resources.providerField),
      reader.readNullableString(Resources.providerAccountIdField),
      reader.readNonBlankString(Resources.nativeSessionIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.providerField]: this.provider,
      [Resources.providerAccountIdField]: this.providerAccountId,
      [Resources.nativeSessionIdField]: this.nativeSessionId
    };
  }

  public matches(provider: string, providerAccountId: string | null): boolean {
    return this.provider === provider && this.providerAccountId === providerAccountId;
  }
}
