/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Approval } from "@noldova/teamrun.protocol";
import type { PermissionRequest } from "@noldova/ui.components.angular";

import type { ApprovalAnswer } from "./approval-answer";

export class ReplyApproval {
  public readonly approval: Approval;
  public readonly answer: ApprovalAnswer | null;
  public readonly request: PermissionRequest | null;

  public constructor(approval: Approval, answer: ApprovalAnswer | null, request: PermissionRequest | null) {
    this.approval = approval;
    this.answer = answer;
    this.request = request;
  }
}
