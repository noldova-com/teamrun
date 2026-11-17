/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { OwnMcpServer } from "@noldova/teamrun.protocol";

export class OwnMcpServerListing {
  public readonly profileDir: string;
  public readonly servers: readonly OwnMcpServer[] | null;
  public readonly error: string | null;
  public readonly isOffered: boolean;

  public constructor(profileDir: string, servers: readonly OwnMcpServer[] | null = null, error: string | null = null, isOffered: boolean = true) {
    this.profileDir = profileDir;
    this.servers = servers;
    this.error = error;
    this.isOffered = isOffered;
  }

  public get isReading(): boolean {
    return this.isOffered && Object.isNull(this.servers) && Object.isNull(this.error);
  }
}
