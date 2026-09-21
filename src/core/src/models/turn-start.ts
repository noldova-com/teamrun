/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { RoleApplication } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class TurnStart {
  public readonly nativeSessionId: string | null;
  public readonly resumedNativeSession: boolean;
  public readonly roleApplied: RoleApplication | null;

  public constructor(nativeSessionId: string | null, resumedNativeSession: boolean, roleApplied: RoleApplication | null = null) {
    if (!Object.isNull(nativeSessionId))
      ArgumentException.throwIfNullOrWhitespace(nativeSessionId, Resources.nativeSessionIdParameterName);
    if (resumedNativeSession && Object.isNull(nativeSessionId))
      throw new ArgumentException(Resources.resumedWithoutSession, Resources.resumedNativeSessionParameterName);

    this.nativeSessionId = nativeSessionId;
    this.resumedNativeSession = resumedNativeSession;
    this.roleApplied = roleApplied;
  }
}
