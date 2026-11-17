/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { TurnDetail } from "@noldova/teamrun.core";

import { RecordingTurnListener } from "./recording-turn-listener.fixture.js";

export class FailingDetailTurnListener extends RecordingTurnListener {
  public override async onDetailAsync(detail: TurnDetail): Promise<void> {
    await super.onDetailAsync(detail);
    throw new Error("listener failure");
  }
}
