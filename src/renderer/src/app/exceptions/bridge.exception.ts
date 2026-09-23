/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";

export class BridgeException extends Exception {
  public readonly info: ServiceResponseInfo | null;

  public constructor(message: string, info: ServiceResponseInfo | null) {
    super(message);

    this.info = info;
  }
}
