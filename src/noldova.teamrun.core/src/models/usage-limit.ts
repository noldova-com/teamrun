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

export class UsageLimit {
  public readonly resetsAt: string | null;

  public constructor(resetsAt: string | null) {
    if (!Object.isNull(resetsAt) && Number.isNaN(Date.parse(resetsAt)))
      throw new ArgumentException(Resources.usageLimitResetUnreadable, Resources.resetsAtParameterName);

    this.resetsAt = resetsAt;
  }
}
