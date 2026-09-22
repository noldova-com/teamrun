/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";

import { Resources } from "../resources.js";

export class CommandFailedException extends Exception {
  public readonly info: ServiceResponseInfo;

  public constructor(info: ServiceResponseInfo) {
    super(Resources.formatFailure(info.name, info.message));

    this.info = info;
  }
}
