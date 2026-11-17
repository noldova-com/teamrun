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

export class SharedMcpSecret {
  public readonly variable: string;
  public readonly reference: string;
  public readonly updatedAt: string | null;

  public constructor(variable: string, reference: string, updatedAt: string | null = null) {
    if (!Resources.environmentVariablePattern.test(variable))
      throw new ArgumentException(Resources.invalidEnvironmentVariable, Resources.variableField);
    if (!Resources.sharedMcpSecretReferencePattern.test(reference))
      throw new ArgumentException(Resources.invalidSharedMcpSecretReference, Resources.referenceField);

    this.variable = variable;
    this.reference = reference;
    this.updatedAt = updatedAt;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpSecret {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpSecret(reader.readNonBlankString(Resources.variableField), reader.readNonBlankString(Resources.referenceField),
      reader.hasField(Resources.updatedAtField) ? reader.readNullableString(Resources.updatedAtField) : null);
  }

  public toJson(): JsonObject {
    return { [Resources.variableField]: this.variable, [Resources.referenceField]: this.reference, [Resources.updatedAtField]: this.updatedAt };
  }
}
