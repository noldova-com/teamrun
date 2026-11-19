/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TurnTools } from "@noldova/teamrun.core";

import { Resources } from "../../resources.js";

export class ServedToolNames {
  public static async listAsync(tools: TurnTools | null, signal: AbortSignal): Promise<readonly string[] | null> {
    if (Object.isNull(tools))
      return null;
    try {
      return (await tools.host.listToolsAsync(signal)).map(t => String(t[Resources.nameField])).sort();
    }
    catch {
      return null;
    }
  }
}
