/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

export class JsonObjects {
  public static is(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }
}
