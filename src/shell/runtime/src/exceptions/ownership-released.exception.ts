/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class OwnershipReleasedException extends Exception {
  public override readonly name: string = "OwnershipReleasedException";

  public constructor() {
    super(Resources.ownershipReleased);
  }
}
