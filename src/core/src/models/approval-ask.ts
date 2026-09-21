/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { ApprovalKind, ApprovalOption } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class ApprovalAsk {
  public readonly providerRequestId: string;
  public readonly kind: ApprovalKind;
  public readonly nativeKind: string;
  public readonly summary: string;
  public readonly payload: JsonValue;
  public readonly options: readonly ApprovalOption[];

  public constructor(
    providerRequestId: string,
    kind: ApprovalKind,
    nativeKind: string,
    summary: string,
    payload: JsonValue,
    options: readonly ApprovalOption[]) {
    ArgumentException.throwIfNullOrWhitespace(providerRequestId, Resources.providerRequestIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(nativeKind, Resources.nativeKindParameterName);
    ArgumentException.throwIfNullOrWhitespace(summary, Resources.summaryParameterName);
    ArgumentException.throwIfEmpty(options, Resources.optionsParameterName);

    this.providerRequestId = providerRequestId;
    this.kind = kind;
    this.nativeKind = nativeKind;
    this.summary = summary;
    this.payload = payload;
    this.options = [...options];
  }
}
