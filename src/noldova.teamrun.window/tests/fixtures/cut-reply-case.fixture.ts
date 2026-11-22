/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageDetail, MessageStatus } from "@noldova/teamrun.protocol";

export class CutReplyCase {
  public readonly status: MessageStatus;
  public readonly details: readonly MessageDetail[];

  public constructor(status: MessageStatus, details: readonly MessageDetail[]) {
    this.status = status;
    this.details = details;
  }
}
