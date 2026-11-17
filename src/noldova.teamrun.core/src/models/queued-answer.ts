/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Approval, MessageSendParams } from "@noldova/teamrun.protocol";

export class QueuedAnswer {
  public readonly approval: Approval;
  public readonly replyTo: string;
  public readonly params: MessageSendParams;
  public readonly prompt: string | null;

  public constructor(approval: Approval, replyTo: string, params: MessageSendParams, prompt: string | null) {
    this.approval = approval;
    this.replyTo = replyTo;
    this.params = params;
    this.prompt = prompt;
  }
}
