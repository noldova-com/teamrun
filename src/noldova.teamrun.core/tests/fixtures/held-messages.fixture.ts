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

export class HeldMessages extends MessagesService {
  public readonly reached: PromiseWithResolvers<void> = Promise.withResolvers();
  public readonly released: PromiseWithResolvers<void> = Promise.withResolvers();
  private readonly holds: (message: Message) => boolean;
  private held: boolean = false;

  public constructor(context: DatabaseContext, holds: (message: Message) => boolean) {
    super(context);
    this.holds = holds;
  }

  public override async updateAsync(message: Message, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction) && !this.held && this.holds(message)) {
      this.held = true;
      this.reached.resolve();
      await this.released.promise;
    }
    await super.updateAsync(message, transaction);
  }
}
