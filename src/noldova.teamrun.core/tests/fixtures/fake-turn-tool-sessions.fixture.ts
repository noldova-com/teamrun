/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ITurnToolSessions, type ToolCallRecord } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";
import { FakeTurnToolSession } from "./fake-turn-tool-session.fixture.js";

export class FakeTurnToolSessions implements ITurnToolSessions {
  public readonly approvedTools: readonly string[] = ["teamrun_delete_chat"];
  public readonly endpoint: string | null;
  public readonly opened: FakeTurnToolSession[] = [];
  public readonly openings: { conversationId: string; workFolder: string; projectId: string | null; agentName: string }[] = [];
  public readonly records: ((call: ToolCallRecord) => void)[] = [];

  public constructor(endpoint: string | null = null) {
    this.endpoint = endpoint;
  }

  public open(scope: string, conversationId: string, workFolder: string, projectId: string | null, agentName: string,
    record: (call: ToolCallRecord) => void): FakeTurnToolSession {
    const session = new FakeTurnToolSession(`session-${this.opened.length + 1}`, scope);
    this.opened.push(session);
    this.openings.push({ conversationId, workFolder, projectId, agentName });
    this.records.push(record);
    ChangeSignal.notify();
    return session;
  }
}
