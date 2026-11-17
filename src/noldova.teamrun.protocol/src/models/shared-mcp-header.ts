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

export class SharedMcpHeader {
  public readonly name: string;
  public readonly variable: string;

  public constructor(name: string, variable: string) {
    if (!Resources.httpHeaderNamePattern.test(name))
      throw new ArgumentException(Resources.invalidHttpHeaderName, Resources.nameField);
    if (!Resources.environmentVariablePattern.test(variable))
      throw new ArgumentException(Resources.invalidEnvironmentVariable, Resources.variableField);

    this.name = name;
    this.variable = variable;
  }

  public static fromJson(value: unknown, path?: string): SharedMcpHeader {
    const reader = JsonReader.fromValue(value, path);
    return new SharedMcpHeader(reader.readString(Resources.nameField), reader.readString(Resources.variableField));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.variableField]: this.variable };
  }
}
