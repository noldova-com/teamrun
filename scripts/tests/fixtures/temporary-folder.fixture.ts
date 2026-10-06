/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, realpath } from "node:fs/promises";
import path from "node:path";

import TemporaryFolder from "../../processes/temporary-folder.ts";

export default class TemporaryFolderFixture extends TemporaryFolder {
  private readonly root: string;

  public readonly platforms: string[] = [];
  public isRemovable: boolean = true;

  public constructor(root: string) {
    super();

    this.root = root;
  }

  public override async createAsync(platform: string, prefix: string): Promise<string> {
    this.platforms.push(platform);
    return realpath(await mkdtemp(path.join(this.root, prefix)));
  }

  public override async removeAsync(folder: string): Promise<void> {
    if (!this.isRemovable)
      throw new Error(`EBUSY: resource busy or locked, rmdir '${folder}'`);
    await super.removeAsync(folder);
  }
}
