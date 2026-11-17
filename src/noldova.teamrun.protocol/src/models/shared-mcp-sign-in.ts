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

export class SharedMcpSignIn {
  public readonly reference: string;
  public readonly expiresAt: string | null;
  public readonly needsSignIn: string | null;
  public readonly updatedAt: string;

  public constructor(reference: string, expiresAt: string | null, needsSignIn: string | null, updatedAt: string) {
    if (!Resources.sharedMcpSignInReferencePattern.test(reference))
      throw new ArgumentException(Resources.invalidSharedMcpSignInReference, Resources.referenceField);
    if (!Object.isNull(needsSignIn))
      ArgumentException.throwIfNullOrWhitespace(needsSignIn, Resources.needsSignInField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);

    this.reference = reference;
    this.expiresAt = expiresAt;
    this.needsSignIn = needsSignIn;
    this.updatedAt = updatedAt;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpSignIn {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpSignIn(reader.readNonBlankString(Resources.referenceField), reader.readNullableString(Resources.expiresAtField),
      reader.readNullableString(Resources.needsSignInField), reader.readNonBlankString(Resources.updatedAtField));
  }

  public toJson(): JsonObject {
    return { [Resources.referenceField]: this.reference, [Resources.expiresAtField]: this.expiresAt, [Resources.needsSignInField]: this.needsSignIn,
      [Resources.updatedAtField]: this.updatedAt };
  }
}
