/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITeamRunBridge } from "../interfaces/i-teamrun-bridge";

export class WindowBridgeFactory {
  public static create(): ITeamRunBridge | null {
    return window.teamrun ?? null;
  }
}
