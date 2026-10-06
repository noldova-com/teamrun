/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import { lstat, mkdir, readlink, rm, writeFile } from "node:fs/promises";

import type { IPathCommandFiles } from "@noldova/teamrun-shell-desktop";

export class PathCommandFilesFixture implements IPathCommandFiles {
  public readingRefusal: string | null = null;
  public writingRefusal: string | null = null;
  public readonly links: Map<string, string> = new Map();

  public lstat(file: string): Promise<Stats> {
    return PathCommandFilesFixture.refuseOr(this.readingRefusal, async () => {
      const stats = await lstat(file);
      return this.links.has(file) ? Object.assign(stats, { isSymbolicLink: () => true }) : stats;
    });
  }

  public readlink(link: string): Promise<string> {
    const target = this.links.get(link);
    return target === undefined ? readlink(link) : Promise.resolve(target);
  }

  public rm(file: string): Promise<void> {
    this.links.delete(file);
    return rm(file);
  }

  public mkdir(folder: string, options: { readonly recursive: true }): Promise<string | undefined> {
    return PathCommandFilesFixture.refuseOr(this.writingRefusal, () => mkdir(folder, options));
  }

  public async symlink(target: string, link: string): Promise<void> {
    await writeFile(link, "", { flag: "wx" });
    this.links.set(link, target);
  }

  private static refuseOr<T>(code: string | null, action: () => Promise<T>): Promise<T> {
    return code === null ? action() : Promise.reject(Object.assign(new Error(`${code}: refused by the test`), { code }));
  }
}
