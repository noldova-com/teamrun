/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { RuntimeHandover } from "@noldova/teamrun-shell-protocol";

import { ProductInfo } from "../models/product-info.js";
import { Resources } from "../resources.js";

export class RuntimeHandoverException extends Exception {
  public readonly handover: RuntimeHandover;

  public constructor(handover: RuntimeHandover) {
    super(Resources.formatHandover(ProductInfo.current.name, handover.identity.productVersion, handover.executablePath));

    this.handover = handover;
  }
}
