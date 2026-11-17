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

export class WaitingMessageIdParams {
  public readonly id: string;

  public constructor(id: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
  }

  public static fromJson(value: unknown, path?: string): WaitingMessageIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new WaitingMessageIdParams(reader.readNonBlankString(Resources.idField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id
    };
  }
}
