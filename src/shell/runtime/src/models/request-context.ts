/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";

export class RequestContext {
  public readonly client: string;
  public readonly payload: JsonValue;
  public readonly signal: AbortSignal;

  public constructor(client: string, payload: JsonValue, signal: AbortSignal) {
    ArgumentException.throwIfNullOrWhitespace(client, Resources.clientParameterName);

    this.client = client;
    this.payload = payload;
    this.signal = signal;
  }
}
