/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import type { IRuntimePart, IRuntimePartContext } from "@noldova/teamrun-shell-runtime";

import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    if (existsSync(path.join(context.moduleFolder, Resources.failureMarker)))
      throw new Error(Resources.failureMessage);

    context.registerMethod(Resources.timeMethod, { handleAsync: async () => ({ time: new Date().toISOString() }) });
  }

  public async deactivateAsync(): Promise<void> {
  }
}
