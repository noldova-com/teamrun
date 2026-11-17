/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class SharedMcpAccess {
  public readonly token: string;
  public readonly expiresAt: string | null;
  public readonly needsSignIn: string | null;

  private constructor(token: string, expiresAt: string | null, needsSignIn: string | null) {
    this.token = token;
    this.expiresAt = expiresAt;
    this.needsSignIn = needsSignIn;
  }

  public static granted(token: string, expiresAt: string | null): SharedMcpAccess {
    return new SharedMcpAccess(token, expiresAt, null);
  }

  public static refused(reason: string): SharedMcpAccess {
    return new SharedMcpAccess(String.empty, null, reason);
  }
}
