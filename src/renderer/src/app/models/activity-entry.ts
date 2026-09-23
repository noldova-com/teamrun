/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageDetail } from "@noldova/teamrun-protocol";

export class ActivityEntry {
  public readonly detail: MessageDetail;
  public readonly result: MessageDetail | null;

  public constructor(detail: MessageDetail, result: MessageDetail | null) {
    this.detail = detail;
    this.result = result;
  }
}
