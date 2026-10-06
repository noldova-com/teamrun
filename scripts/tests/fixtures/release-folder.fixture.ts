/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import PackageTarget from "../../packaging/package-target.ts";
import ReleaseFileSet from "../../release/release-file-set.ts";

export default class ReleaseFolderFixture {
  public static readonly RELEASE_DATE: string = "2026-10-05T23:00:00.000Z";

  private static readonly PREFIX: string = "teamrun-release-";

  public readonly folder: string;
  public readonly files: ReleaseFileSet;

  private constructor(folder: string, files: ReleaseFileSet) {
    this.folder = folder;
    this.files = files;
  }

  public static async createAsync(productName: string = "TeamRun", version: string = "0.0.2"): Promise<ReleaseFolderFixture> {
    const fixture = new ReleaseFolderFixture(await mkdtemp(path.join(tmpdir(), ReleaseFolderFixture.PREFIX)), new ReleaseFileSet(productName));
    for (const target of PackageTarget.listAll()) {
      for (const extension of target.extensions) {
        const name = target.formatFileName(productName, extension);
        await writeFile(path.join(fixture.folder, name), `${name}\n`);
      }
      await fixture.files.writeAsync(fixture.folder, target, version, ReleaseFolderFixture.RELEASE_DATE);
    }
    return fixture;
  }

  public get names(): readonly string[] {
    return this.files.listAll();
  }

  public locate(name: string): string {
    return path.join(this.folder, name);
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
