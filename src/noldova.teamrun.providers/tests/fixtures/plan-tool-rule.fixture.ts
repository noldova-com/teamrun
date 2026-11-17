/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert } from "@noldova/context.testing";
import { type IProviderAdapter, Resources as CoreResources, TurnOutcome, TurnRequest } from "@noldova/teamrun.core";

import { RecordingTurnListener } from "./recording-turn-listener.fixture.js";

export class PlanToolRule {
  public static async expectSentAsync(adapter: IProviderAdapter, request: TurnRequest): Promise<void> {
    const listener = new RecordingTurnListener();
    const instructions = CoreResources.formatTeammateInstructions("Review carefully", null);

    const turn = await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, request.resumeNativeSessionId,
      request.attachments, instructions, request.freshPrompt, request.environment, request.compacts), listener, new AbortController().signal);

    const payload = listener.texts.join("\n");
    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    Assert.isTrue(payload.includes(CoreResources.planToolInstructions), payload);
    Assert.isTrue(payload.includes("Review carefully"), payload);
  }
}
