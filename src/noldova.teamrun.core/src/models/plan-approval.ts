/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, Provenance } from "@noldova/teamrun.protocol";

export class PlanApproval {
  public readonly reply: Message;
  public readonly approved: Message;
  public readonly provenance: Provenance;

  public constructor(reply: Message, approved: Message, provenance: Provenance) {
    this.reply = reply;
    this.approved = approved;
    this.provenance = provenance;
  }
}
