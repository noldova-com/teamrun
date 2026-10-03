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

export class SocketFolderFixture implements AsyncDisposable {
  private static readonly POSIX_ROOT: string = "/tmp";

  public readonly path: string;

  private constructor(folder: string) {
    this.path = folder;
  }

  public static async createAsync(prefix: string): Promise<SocketFolderFixture> {
    const root = process.platform === "win32" ? tmpdir() : SocketFolderFixture.POSIX_ROOT;
    return new SocketFolderFixture(await mkdtemp(path.join(root, prefix)));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.path, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
