/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export default class TemporaryFolder {
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly SHORT_ROOT: string = "/tmp";

  public static locateRoot(platform: string): string {
    return platform === TemporaryFolder.WINDOWS_PLATFORM ? tmpdir() : TemporaryFolder.SHORT_ROOT;
  }

  public async createAsync(platform: string, prefix: string): Promise<string> {
    return realpath(await mkdtemp(path.join(TemporaryFolder.locateRoot(platform), prefix)));
  }
}
