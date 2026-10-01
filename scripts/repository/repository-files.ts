/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import type Git from "./git.ts";

export default class RepositoryFiles {
  private static readonly LIST_ARGUMENTS: readonly string[] = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"];

  private readonly root: string;
  private readonly git: Git;

  public constructor(root: string, git: Git) {
    this.root = root;
    this.git = git;
  }

  public async listAsync(): Promise<readonly string[]> {
    const listed = (await this.git.readOutputAsync(RepositoryFiles.LIST_ARGUMENTS)).split("\0");
    return listed.filter(t => t.length > 0 && existsSync(path.join(this.root, t))).sort();
  }
}
