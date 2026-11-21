/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Approval, Message } from "@noldova/teamrun.protocol";

export class StoppedReply {
  public readonly open: Message;
  public readonly withoutSubAgents: Message;
  public readonly message: Message;
  public readonly cancelled: readonly Approval[];

  public constructor(open: Message, withoutSubAgents: Message, message: Message, cancelled: readonly Approval[]) {
    this.open = open;
    this.withoutSubAgents = withoutSubAgents;
    this.message = message;
    this.cancelled = cancelled;
  }
}
