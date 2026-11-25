/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { McpEndpoint } from "@noldova/teamrun.core";

import { ServedEndpoint } from "./served-endpoint.js";

export class CodexToolGrant {
  private served: ServedEndpoint | null = null;
  private revokeIssued: () => void = () => undefined;

  public get connection(): ServedEndpoint | null {
    return this.served;
  }

  public issue(target: McpEndpoint): void {
    const token = target.issueKept();
    this.served = new ServedEndpoint(target.url, token);
    this.revokeIssued = () => target.revoke(token);
  }

  public keep(url: string, token: string): void {
    this.served = new ServedEndpoint(url, token);
  }

  public revoke(): void {
    this.revokeIssued();
  }
}
