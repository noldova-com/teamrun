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

export class UpdateOperation {
  public readonly id: string;

  public constructor(id: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);

    this.id = id;
  }

  public static fromJson(value: unknown): UpdateOperation {
    return new UpdateOperation(JsonReader.fromValue(value).readNonBlankString(Resources.idField));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id };
  }
}
