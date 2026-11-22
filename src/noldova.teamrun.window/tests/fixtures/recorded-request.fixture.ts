/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class RecordedRequest {
  public readonly method: string;
  public readonly parameters: JsonValue;

  public constructor(method: string, parameters: JsonValue) {
    this.method = method;
    this.parameters = parameters;
  }
}
