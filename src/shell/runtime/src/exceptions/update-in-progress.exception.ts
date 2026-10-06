/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { UpdateBarrierStatus } from "../enums/update-barrier-status.js";
import { ProductInfo } from "../models/product-info.js";
import { Resources } from "../resources.js";

export class UpdateInProgressException extends Exception {
  public override readonly name: string = "UpdateInProgressException";
  public readonly status: UpdateBarrierStatus;

  public constructor(status: UpdateBarrierStatus) {
    super(status === UpdateBarrierStatus.Unfinished ? Resources.formatUpdateUnfinished(ProductInfo.current.name) : Resources.formatUpdateInProgress(ProductInfo.current.name));

    this.status = status;
  }
}
