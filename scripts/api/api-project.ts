/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default class ApiProject {
  private static readonly BUILD_FOLDER: string = "_build";
  private static readonly FILE_NAME: string = "tsconfig.json";

  public readonly folder: string;
  public readonly file: string;

  public constructor(root: string, purpose: string, id: string) {
    this.folder = path.join(root, ApiProject.BUILD_FOLDER, purpose, id);
    this.file = path.join(this.folder, ApiProject.FILE_NAME);
  }

  public async writeAsync(base: string, root: string, files: readonly string[]): Promise<void> {
    await mkdir(this.folder, { recursive: true });
    const project = { extends: base, compilerOptions: { noEmit: true, rootDir: root }, files };
    await writeFile(this.file, `${JSON.stringify(project, null, 2)}\n`);
  }
}
