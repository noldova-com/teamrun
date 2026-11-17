/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SharedMcpFailure } from "./shared-mcp-failure.js";

export class ReportedSharedMcpFailures {
  private readonly reported: Map<string, Set<string>> = new Map();

  public add(conversationId: string, failure: SharedMcpFailure): boolean {
    const keys = this.reported.get(conversationId) ?? new Set<string>();
    this.reported.set(conversationId, keys);
    if (keys.has(failure.key))
      return false;
    keys.add(failure.key);
    return true;
  }

  public forget(conversationIds: readonly string[]): void {
    for (const conversationId of conversationIds)
      this.reported.delete(conversationId);
  }
}
