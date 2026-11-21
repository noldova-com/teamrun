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
import type { Message } from "@noldova/teamrun.protocol";

export class FailingMessages extends MessagesService {
  private readonly fails: (message: Message) => boolean;
  private readonly error: Error;
  private failed: boolean = false;

  public constructor(context: DatabaseContext, fails: (message: Message) => boolean, error: Error) {
    super(context);
    this.fails = fails;
    this.error = error;
  }

  public override async updateAsync(message: Message, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction) && !this.failed && this.fails(message)) {
      this.failed = true;
      throw this.error;
    }
    await super.updateAsync(message, transaction);
  }
}
