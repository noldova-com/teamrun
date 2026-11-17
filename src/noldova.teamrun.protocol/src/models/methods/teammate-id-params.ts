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

export class TeammateIdParams {
  public readonly teammateId: string;

  public constructor(
    teammateId: string) {
    ArgumentException.throwIfNullOrWhitespace(teammateId, Resources.teammateIdField);

    this.teammateId = teammateId;
  }

  public static fromJson(value: unknown, path?: string): TeammateIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new TeammateIdParams(
      reader.readNonBlankString(Resources.teammateIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.teammateIdField]: this.teammateId
    };
  }
}
