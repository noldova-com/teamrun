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

import type { IGitHubAccess } from "../interfaces/i-github-access.js";
import { Resources } from "../resources.js";

export class SharedMcpAccounts implements ISharedMcpAccounts {
  private readonly find: () => IGitHubAccess | null;

  public constructor(find: () => IGitHubAccess | null) {
    this.find = find;
  }

  public static isGitHubAccess(service: object): service is IGitHubAccess {
    return "accessAsync" in service && typeof service.accessAsync === "function";
  }

  public async accessAsync(account: SharedMcpAccount): Promise<SharedMcpAccess> {
    const access = this.find();
    if (Object.isNull(access))
      return SharedMcpAccess.refused(Resources.formatSharedMcpAccountInactive(account));
    const answer = await access.accessAsync(AbortSignal.timeout(Resources.sharedMcpRequestTimeout));
    return "token" in answer ? SharedMcpAccess.granted(answer.token, null) : SharedMcpAccess.refused(answer.reason);
  }
}
