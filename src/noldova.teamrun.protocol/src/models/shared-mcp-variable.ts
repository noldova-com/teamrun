/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { SharedMcpVariableSource } from "../enums/shared-mcp-variable-source.js";
import { Resources } from "../resources.js";

export class SharedMcpVariable {
  public readonly variable: string;
  public readonly source: SharedMcpVariableSource;
  public readonly set: boolean;
  public readonly updatedAt: string | null;

  public constructor(variable: string, source: SharedMcpVariableSource, set: boolean, updatedAt: string | null = null) {
    if (!Resources.environmentVariablePattern.test(variable))
      throw new ArgumentException(Resources.invalidEnvironmentVariable, Resources.variableField);
    if (!Object.values(SharedMcpVariableSource).includes(source))
      throw new ArgumentException(Resources.invalidSharedMcpVariableSource, Resources.sourceField);

    this.variable = variable;
    this.source = source;
    this.set = set;
    this.updatedAt = updatedAt;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpVariable {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpVariable(reader.readNonBlankString(Resources.variableField),
      reader.readOneOf(Resources.sourceField, Object.values(SharedMcpVariableSource)), reader.readBoolean(Resources.setField),
      reader.hasField(Resources.updatedAtField) ? reader.readNullableString(Resources.updatedAtField) : null);
  }

  public toJson(): JsonObject {
    return { [Resources.variableField]: this.variable, [Resources.sourceField]: this.source, [Resources.setField]: this.set, [Resources.updatedAtField]: this.updatedAt };
  }
}
