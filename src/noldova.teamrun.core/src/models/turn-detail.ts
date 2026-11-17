/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { DetailKind, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class TurnDetail {
  public readonly kind: DetailKind;
  public readonly text: string;
  public readonly payload: JsonValue;
  public readonly providerItemId: string | null;
  public readonly parentItemId: string | null;

  public constructor(kind: DetailKind, text: string, payload: JsonValue, providerItemId: string | null, parentItemId: string | null = null) {
    if (!Object.isNull(providerItemId))
      ArgumentException.throwIfNullOrWhitespace(providerItemId, Resources.providerItemIdParameterName);
    if (!Object.isNull(parentItemId))
      ArgumentException.throwIfNullOrWhitespace(parentItemId, Resources.parentItemIdParameterName);
    if (!Object.isNull(parentItemId) && kind === DetailKind.Text)
      throw new ArgumentException(ProtocolResources.nestedTextDetail, Resources.parentItemIdParameterName);

    this.kind = kind;
    this.text = text;
    this.payload = payload;
    this.providerItemId = providerItemId;
    this.parentItemId = parentItemId;
  }
}
