/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { RunningWork } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../resources.js";

export class WorkInProgressException extends Exception {
  public readonly work: RunningWork;

  public constructor(work: RunningWork) {
    super(Resources.formatWorkInProgress(work.descriptions));

    this.work = work;
  }
}
