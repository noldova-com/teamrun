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
  private readonly held: (() => void)[] = [];
  private isHolding: boolean = false;

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const isMany = existsSync(path.join(context.moduleFolder, Resources.manyTabsMarker));
    const isLongCount = existsSync(path.join(context.moduleFolder, Resources.longCountMarker));
    this.isHolding = existsSync(path.join(context.moduleFolder, Resources.holdFirstOptionsMarker));
    const runtime = randomUUID();
    context.registerMethod(Resources.optionsMethod, {
      handleAsync: async () => {
        if (this.isHolding) {
          this.isHolding = false;
          await new Promise<void>(resolve => this.held.push(resolve));
        }
        return { isMany, isLongCount, runtime };
      }
    });
    context.registerMethod(Resources.holdOptionsMethod, {
      handleAsync: async () => {
        this.isHolding = true;
        return null;
      }
    });
    context.registerMethod(Resources.heldOptionsMethod, { handleAsync: async () => this.held.length });
    context.registerMethod(Resources.releaseOptionsMethod, {
      handleAsync: async () => {
        this.held.splice(0).forEach(release => release());
        return null;
      }
    });
  }

  public async deactivateAsync(): Promise<void> {
  }
}
