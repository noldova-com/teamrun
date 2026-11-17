/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class ProcessOrigin {
  public readonly kind: string;
  public readonly providerId: string | null;

  public constructor(kind: string, providerId: string | null) {
    ArgumentException.throwIfNullOrWhitespace(kind, Resources.kindParameterName);

    this.kind = kind;
    this.providerId = providerId;
  }
}
