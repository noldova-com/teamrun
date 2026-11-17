/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ClaudeTurn, IClaudeQuery } from "@noldova/teamrun.providers";

export class TurnFeed {
  public static async consume(turn: ClaudeTurn, query: IClaudeQuery): Promise<void> {
    for await (const message of query)
      await turn.handle(message, query);
    await turn.finishAsync();
  }
}
