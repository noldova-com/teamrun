/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class AcpSession {
  public readonly id: string;
  public readonly resumed: boolean;
  public readonly result: JsonReader;

  public constructor(id: string, resumed: boolean, result: JsonReader) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.sessionIdParameterName);

    this.id = id;
    this.resumed = resumed;
    this.result = result;
  }
}
