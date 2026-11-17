/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SessionTokens } from "../services/engine/session-tokens.js";

export class McpEndpoint {
  public readonly url: string;
  private readonly tokens: SessionTokens;
  private readonly session: string;

  public constructor(url: string, tokens: SessionTokens, session: string) {
    this.url = url;
    this.tokens = tokens;
    this.session = session;
  }

  public issue(): string {
    return this.tokens.issue(this.session);
  }

  public issueKept(): string {
    return this.tokens.issueKept(this.session);
  }

  public adopt(token: string): boolean {
    return this.tokens.adopt(token, this.session);
  }

  public revoke(token: string): void {
    this.tokens.revoke(token);
  }
}
