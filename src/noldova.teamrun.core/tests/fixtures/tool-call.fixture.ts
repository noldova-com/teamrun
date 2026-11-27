/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { TurnDetail } from "@noldova/teamrun.core";

export class ToolCall {
  public readonly open: TurnDetail;
  public readonly close: TurnDetail;

  public constructor(open: TurnDetail, close: TurnDetail) {
    this.open = open;
    this.close = close;
  }

  public get steps(): readonly TurnDetail[] {
    return [this.open, this.close];
  }
}
