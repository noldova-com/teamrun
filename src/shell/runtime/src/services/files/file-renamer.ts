/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rename } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class FileRenamer {
  private readonly renameFileAsync: (from: string, to: string) => Promise<void>;

  public constructor(renameFileAsync: (from: string, to: string) => Promise<void> = rename) {
    this.renameFileAsync = renameFileAsync;
  }

  public async renameAsync(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.renameFileAsync(from, to);
        return;
      }
      catch (error) {
        if (attempt >= Resources.replaceAttempts || !FileRenamer.isHeld(error))
          throw error;
      }
      await delay(Resources.replaceRetryDelay);
    }
  }

  private static isHeld(error: unknown): boolean {
    return Object.isObject(error) && Resources.fileErrorCodeField in error && Resources.busyFileErrorCodes.includes(String(error[Resources.fileErrorCodeField]));
  }
}
