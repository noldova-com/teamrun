/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { RuntimeHandover } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../resources.js";

export class BuildMismatchException extends Exception {
  public readonly handover: RuntimeHandover;

  public constructor(handover: RuntimeHandover) {
    super(Resources.formatBuildMismatch(handover.identity.productVersion, handover.executablePath));

    this.handover = handover;
  }
}
