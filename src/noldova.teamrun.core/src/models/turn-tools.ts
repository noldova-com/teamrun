/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMcpToolHost } from "@noldova/teamrun.protocol";

import type { McpEndpoint } from "./mcp-endpoint.js";

export class TurnTools {
  public readonly host: IMcpToolHost;
  public readonly approvedTools: readonly string[];
  public readonly endpoint: McpEndpoint | null;
  private readonly listing: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly failing: PromiseWithResolvers<unknown> = Promise.withResolvers<unknown>();
  private wasListed: boolean = false;

  public constructor(host: IMcpToolHost, approvedTools: readonly string[], endpoint: McpEndpoint | null = null) {
    this.host = host;
    this.approvedTools = [...approvedTools];
    this.endpoint = endpoint;
  }

  public get listed(): Promise<void> {
    return this.listing.promise;
  }

  public get isListed(): boolean {
    return this.wasListed;
  }

  public get failed(): Promise<unknown> {
    return this.failing.promise;
  }

  public markListed(): void {
    this.wasListed = true;
    this.listing.resolve();
  }

  public markFailed(error: unknown): void {
    this.failing.resolve(error);
  }

  public adopt(token: string): boolean {
    return this.endpoint?.adopt(token) ?? false;
  }
}
