/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { McpEndpoint, SessionTokens } from "@noldova/teamrun.core";

export class RecordingMcpEndpoint extends McpEndpoint {
  public readonly issued: string[] = [];
  public readonly adopted: string[] = [];
  private readonly sessions: SessionTokens;

  public constructor(sessions: SessionTokens = new SessionTokens(), session: string = "member", owner: string = "c1/t1") {
    super("http://127.0.0.1:4711/mcp", sessions, session);
    this.sessions = sessions;
    sessions.open(session, owner);
  }

  public get lastIssued(): string {
    return this.issued.at(-1) ?? String.empty;
  }

  public override issueKept(): string {
    const token = super.issueKept();
    this.issued.push(token);
    return token;
  }

  public override adopt(token: string): boolean {
    this.adopted.push(token);
    return super.adopt(token);
  }

  public isLive(token: string): boolean {
    return !Object.isNull(this.sessions.find(token));
  }
}
