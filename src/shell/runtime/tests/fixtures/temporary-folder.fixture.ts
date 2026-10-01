/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class TemporaryFolderFixture implements AsyncDisposable {
  public readonly path: string;

  private constructor(folder: string) {
    this.path = folder;
  }

  public static async createAsync(): Promise<TemporaryFolderFixture> {
    return new TemporaryFolderFixture(await mkdtemp(path.join(tmpdir(), "teamrun-runtime-")));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }
}
