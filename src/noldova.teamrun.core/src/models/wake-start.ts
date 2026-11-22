/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReplyWork } from "./reply-work.js";

export class WakeStart {
  public readonly work: ReplyWork | null;
  public readonly reason: string | null;
  public readonly stopped: boolean;

  public constructor(work: ReplyWork | null, reason: string | null, stopped: boolean) {
    this.work = work;
    this.reason = reason;
    this.stopped = stopped;
  }
}
