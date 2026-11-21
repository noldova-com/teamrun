/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SqlTransaction } from "@noldova/context.data.sql";
import { type DatabaseContext, MessagesService } from "@noldova/teamrun.core";
import type { Message, MessageStatus } from "@noldova/teamrun.protocol";

export class AfterStatusMessages extends MessagesService {
  public readonly statuses: MessageStatus[] = [];
  private readonly status: MessageStatus;
  private readonly after: () => Promise<void>;

  public constructor(context: DatabaseContext, status: MessageStatus, after: () => Promise<void>) {
    super(context);
    this.status = status;
    this.after = after;
  }

  public override async updateAsync(message: Message, transaction?: SqlTransaction): Promise<void> {
    await super.updateAsync(message, transaction);
    if (!Object.isUndefined(transaction))
      return;
    this.statuses.push(message.status);
    if (message.status === this.status)
      await this.after();
  }
}
