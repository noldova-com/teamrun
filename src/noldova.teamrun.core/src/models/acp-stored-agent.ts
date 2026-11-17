/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export class AcpStoredAgent {
  public readonly kind: string;
  public readonly name: string;
  public readonly json: JsonObject;

  public constructor(kind: string, name: string, json: JsonObject) {
    this.kind = kind;
    this.name = name;
    this.json = json;
  }
}
