/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SessionTokens, TurnStart } from "@noldova/teamrun.core";

import type { RecordingMcpEndpoint } from "./recording-mcp-endpoint.fixture.js";
import { RecordingTurnListener } from "./recording-turn-listener.fixture.js";

export class TokenRecordingTurnListener extends RecordingTurnListener {
  public readonly sessionsAtStart: (string | null)[] = [];
  private readonly tokens: SessionTokens;
  private readonly endpoint: RecordingMcpEndpoint;

  public constructor(tokens: SessionTokens, endpoint: RecordingMcpEndpoint) {
    super();
    this.tokens = tokens;
    this.endpoint = endpoint;
  }

  public override onStartedAsync(start: TurnStart): Promise<void> {
    this.sessionsAtStart.push(this.tokens.find(this.endpoint.lastIssued));
    return super.onStartedAsync(start);
  }
}
