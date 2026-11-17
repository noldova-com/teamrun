/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class ComputerUseGrantIdParams {
  public readonly grantId: string;

  public constructor(grantId: string) {
    ArgumentException.throwIfNullOrWhitespace(grantId, Resources.grantIdField);

    this.grantId = grantId;
  }

  public static fromJson(value: unknown, path?: string): ComputerUseGrantIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new ComputerUseGrantIdParams(reader.readNonBlankString(Resources.grantIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.grantIdField]: this.grantId
    };
  }
}
