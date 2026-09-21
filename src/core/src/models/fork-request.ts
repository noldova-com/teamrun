/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { ProviderAccount, RequestedSettings } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class ForkRequest {
  public readonly account: ProviderAccount | null;
  public readonly workingDirectory: string;
  public readonly nativeSessionId: string;
  public readonly lastTurnId: string;
  public readonly requested: RequestedSettings;

  public constructor(account: ProviderAccount | null, workingDirectory: string, nativeSessionId: string, lastTurnId: string, requested: RequestedSettings) {
    ArgumentException.throwIfNullOrWhitespace(workingDirectory, Resources.workingDirectoryParameterName);
    ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(lastTurnId, Resources.lastTurnIdParameterName);

    this.account = account;
    this.workingDirectory = workingDirectory;
    this.nativeSessionId = nativeSessionId;
    this.lastTurnId = lastTurnId;
    this.requested = requested;
  }
}
