/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { PreShellData } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../resources.js";

export class PreShellDataFoundException extends Exception {
  public readonly data: PreShellData;

  public constructor(data: PreShellData) {
    super(Resources.formatPreShellFound(data.location));

    this.data = data;
  }
}
