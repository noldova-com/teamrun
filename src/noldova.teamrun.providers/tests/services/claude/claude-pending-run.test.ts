/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ClaudePendingRun } from "../../../src/services/claude/claude-pending-run.js";
import { ClaudeTurn } from "../../../src/services/claude/claude-turn.js";
import { DeltaStream } from "../../../src/services/delta-stream.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class ClaudePendingRunTests {
  @TestMethod
  public keepsWhatItIsGivenHoldingNoMessageNotYetTaken(): void {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const done = Promise.withResolvers<boolean>();
    const environment = { CLAUDE_CODE_ENTRYPOINT: "teamrun" };
    let interruptions = 0;
    const interrupted = (): void => {
      interruptions += 1;
    };

    const run = new ClaudePendingRun(turn, "u-1", done, environment, interrupted);
    run.interrupted();

    Assert.isTrue(run.turn === turn && run.done === done && run.environment === environment);
    Assert.areEqual(JSON.stringify(["u-1", null, false, 1]), JSON.stringify([run.uuid, run.held, run.taken, interruptions]));
  }
}
