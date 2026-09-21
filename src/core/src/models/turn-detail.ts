/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { DetailKind } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class TurnDetail {
  public readonly kind: DetailKind;
  public readonly text: string;
  public readonly payload: JsonValue;
  public readonly providerItemId: string | null;

  public constructor(kind: DetailKind, text: string, payload: JsonValue, providerItemId: string | null) {
    if (!Object.isNull(providerItemId))
      ArgumentException.throwIfNullOrWhitespace(providerItemId, Resources.providerItemIdParameterName);

    this.kind = kind;
    this.text = text;
    this.payload = payload;
    this.providerItemId = providerItemId;
  }
}
