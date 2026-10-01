/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

export default class PackageCatalog {
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly DEPENDENCY_FOLDER: string = "node_modules";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async listManifestsAsync(): Promise<readonly string[]> {
    const source = path.join(this.root, PackageCatalog.SOURCE_FOLDER);
    if (!existsSync(source))
      return [];

    const entries = await readdir(source, { recursive: true });
    return entries
      .map(t => `${PackageCatalog.SOURCE_FOLDER}/${t.split(path.sep).join("/")}`)
      .filter(t => path.posix.basename(t) === PackageCatalog.MANIFEST_NAME && !t.split("/").includes(PackageCatalog.DEPENDENCY_FOLDER))
      .sort();
  }
}
