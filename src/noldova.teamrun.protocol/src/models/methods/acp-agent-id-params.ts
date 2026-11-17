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

export class AcpAgentIdParams {
  public readonly id: string;

  public constructor(id: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): AcpAgentIdParams {
    return new AcpAgentIdParams(JsonReader.fromValue(value, path).readNonBlankString(Resources.idField));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id };
  }
}
