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

export class SharedMcpSecretSetParams {
  public readonly serverId: string;
  public readonly variable: string;
  public readonly reference: string | null;

  public constructor(serverId: string, variable: string, reference: string | null) {
    ArgumentException.throwIfNullOrWhitespace(serverId, Resources.serverIdField);
    if (!Resources.environmentVariablePattern.test(variable))
      throw new ArgumentException(Resources.invalidEnvironmentVariable, Resources.variableField);
    if (!Object.isNull(reference) && !Resources.sharedMcpSecretReferencePattern.test(reference))
      throw new ArgumentException(Resources.invalidSharedMcpSecretReference, Resources.referenceField);

    this.serverId = serverId;
    this.variable = variable;
    this.reference = reference;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpSecretSetParams {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpSecretSetParams(reader.readNonBlankString(Resources.serverIdField), reader.readNonBlankString(Resources.variableField),
      reader.readNullableString(Resources.referenceField));
  }

  public toJson(): JsonObject {
    return { [Resources.serverIdField]: this.serverId, [Resources.variableField]: this.variable, [Resources.referenceField]: this.reference };
  }
}
