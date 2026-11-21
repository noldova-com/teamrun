/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Approval } from "@noldova/teamrun.protocol";

import type { QueuedAnswer } from "./queued-answer.js";

export class DecidedApproval {
  public readonly approval: Approval;
  public readonly queued: QueuedAnswer | null;

  public constructor(approval: Approval, queued: QueuedAnswer | null) {
    this.approval = approval;
    this.queued = queued;
  }
}
