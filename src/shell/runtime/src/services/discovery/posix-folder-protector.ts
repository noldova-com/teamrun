/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod } from "node:fs/promises";

import type { IFolderProtector } from "../../interfaces/i-folder-protector.js";
import { Resources } from "../../resources.js";

export class PosixFolderProtector implements IFolderProtector {
  public async protectAsync(folder: string): Promise<void> {
    await chmod(folder, Resources.privateFolderMode);
  }
}
