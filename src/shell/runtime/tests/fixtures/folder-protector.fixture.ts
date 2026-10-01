/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFolderProtector } from "@noldova/teamrun-shell-runtime";

export class FolderProtectorFixture implements IFolderProtector {
  public readonly folders: string[] = [];

  public async protectAsync(folder: string): Promise<void> {
    this.folders.push(folder);
  }
}
