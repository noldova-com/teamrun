/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";

import type { IPathCommandFiles } from "@noldova/teamrun-shell-desktop";

export class PathCommandFilesFixture implements IPathCommandFiles {
  public readingRefusal: string | null = null;
  public writingRefusal: string | null = null;

  public lstat(file: string): Promise<Stats> {
    return PathCommandFilesFixture.refuseOr(this.readingRefusal, () => lstat(file));
  }

  public readlink(link: string): Promise<string> {
    return readlink(link);
  }

  public rm(file: string): Promise<void> {
    return rm(file);
  }

  public mkdir(folder: string, options: { readonly recursive: true }): Promise<string | undefined> {
    return PathCommandFilesFixture.refuseOr(this.writingRefusal, () => mkdir(folder, options));
  }

  public symlink(target: string, link: string): Promise<void> {
    return symlink(target, link);
  }

  private static refuseOr<T>(code: string | null, action: () => Promise<T>): Promise<T> {
    return code === null ? action() : Promise.reject(Object.assign(new Error(`${code}: refused by the test`), { code }));
  }
}
