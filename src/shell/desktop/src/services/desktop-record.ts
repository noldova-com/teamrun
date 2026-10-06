/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { Installation, ProcessPresence } from "@noldova/teamrun-shell-runtime";

import { Resources } from "../resources.js";

export class DesktopRecord {
  public static async recordAsync(installation: Pick<Installation, "recordDesktopAsync">, presence: Pick<ProcessPresence, "stampAsync">, processId: number): Promise<boolean> {
    const [desktop] = await presence.stampAsync([[processId, Resources.clientName]]);
    if (Object.isUndefined(desktop))
      return false;
    await installation.recordDesktopAsync(desktop);
    return true;
  }
}
