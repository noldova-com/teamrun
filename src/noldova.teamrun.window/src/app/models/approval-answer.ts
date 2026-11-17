/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionStatus } from "@noldova/ui.components.angular";

export class ApprovalAnswer {
  public readonly optionId: string;
  public readonly status: PermissionStatus;
  public readonly answeredAt: Date;

  public constructor(optionId: string, status: PermissionStatus, answeredAt: Date) {
    this.optionId = optionId;
    this.status = status;
    this.answeredAt = new Date(answeredAt.getTime());
  }

  public get isSending(): boolean {
    return this.status === PermissionStatus.Sending;
  }

  public static sending(optionId: string, answeredAt: Date): ApprovalAnswer {
    return new ApprovalAnswer(optionId, PermissionStatus.Sending, answeredAt);
  }

  public failed(): ApprovalAnswer {
    return new ApprovalAnswer(this.optionId, PermissionStatus.SendFailed, this.answeredAt);
  }
}
