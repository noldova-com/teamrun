/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class SharedMcpRefusal {
  public readonly reason: string;
  public readonly short: string | null;

  public constructor(reason: string, short: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(reason, Resources.reasonParameterName);
    if (!Object.isNull(short))
      ArgumentException.throwIfNullOrWhitespace(short, Resources.shortParameterName);

    this.reason = reason;
    this.short = short;
  }
}
