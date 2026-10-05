/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

import type { IRuntimePart, IRuntimePartContext } from "@noldova/teamrun-shell-runtime";

import { Resources } from "./resources.js";

export class RuntimePart implements IRuntimePart {
  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const isMany = existsSync(path.join(context.moduleFolder, Resources.manyTabsMarker));
    const isLongCount = existsSync(path.join(context.moduleFolder, Resources.longCountMarker));
    const runtime = randomUUID();
    context.registerMethod(Resources.optionsMethod, { handleAsync: async () => ({ isMany, isLongCount, runtime }) });
  }

  public async deactivateAsync(): Promise<void> {
  }
}
