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

export class WindowIdParams {
  public readonly windowId: string;

  public constructor(windowId: string) {
    ArgumentException.throwIfNullOrWhitespace(windowId, Resources.windowIdField);

    this.windowId = windowId;
  }

  public static fromJson(value: unknown, path?: string): WindowIdParams {
    const reader = JsonReader.fromValue(value, path);
    return new WindowIdParams(reader.readNonBlankString(Resources.windowIdField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.windowIdField]: this.windowId
    };
  }
}
