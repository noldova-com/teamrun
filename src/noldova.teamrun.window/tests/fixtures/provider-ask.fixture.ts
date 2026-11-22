/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ApprovalKind } from "@noldova/teamrun.protocol";

export class ProviderAsk {
  public readonly provider: string;
  public readonly kind: ApprovalKind;
  public readonly nativeKind: string;

  public constructor(provider: string, kind: ApprovalKind, nativeKind: string) {
    this.provider = provider;
    this.kind = kind;
    this.nativeKind = nativeKind;
  }
}
