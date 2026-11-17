/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SharedMcpFailureKind } from "../enums/shared-mcp-failure-kind.js";

export class SharedMcpFailure {
  public readonly providerId: string;
  public readonly providerLabel: string;
  public readonly server: string;
  public readonly kind: SharedMcpFailureKind;
  public readonly reason: string | null;

  public constructor(providerId: string, providerLabel: string, server: string, kind: SharedMcpFailureKind, reason: string | null = null) {
    this.providerId = providerId;
    this.providerLabel = providerLabel;
    this.server = server;
    this.kind = kind;
    this.reason = reason;
  }

  public get key(): string {
    return JSON.stringify([this.providerId, this.server, this.kind]);
  }
}
