/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageStatus } from "@noldova/teamrun.protocol";

export class StatusMark {
  public readonly status: MessageStatus;
  public readonly text: string | null;
  public readonly failed: boolean | null;

  public constructor(status: MessageStatus, text: string | null, failed: boolean | null) {
    this.status = status;
    this.text = text;
    this.failed = failed;
  }
}
