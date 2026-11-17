/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ISharedMcpAccounts, SharedMcpAccess } from "@noldova/teamrun.core";
import type { SharedMcpAccount } from "@noldova/teamrun.protocol";

export class FakeSharedMcpAccounts implements ISharedMcpAccounts {
  public readonly reads: SharedMcpAccount[] = [];
  public access: SharedMcpAccess = SharedMcpAccess.granted("github-token-7c41a9", null);
  public refusal: string | null = null;

  public accessAsync(account: SharedMcpAccount): Promise<SharedMcpAccess> {
    this.reads.push(account);
    return Object.isNull(this.refusal) ? Promise.resolve(this.access) : Promise.reject(new Error(this.refusal));
  }
}
