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

export class ProviderKindParams {
  public readonly kind: string;

  public constructor(kind: string) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindField);

    this.kind = kind;
  }

  public static fromJson(value: unknown, path?: string): ProviderKindParams {
    return new ProviderKindParams(JsonReader.fromValue(value, path).readNonBlankString(Resources.kindField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind
    };
  }
}
