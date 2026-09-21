/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AuthStatus, ProviderAccountIdentity } from "@noldova/teamrun-protocol";

export class SignInCheck {
  public readonly authStatus: AuthStatus;
  public readonly identity: ProviderAccountIdentity | null;
  public readonly harnessVersion: string | null;
  public readonly error: string | null;

  public constructor(authStatus: AuthStatus, identity: ProviderAccountIdentity | null, harnessVersion: string | null, error: string | null) {
    this.authStatus = authStatus;
    this.identity = identity;
    this.harnessVersion = harnessVersion;
    this.error = error;
  }
}
