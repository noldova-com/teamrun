/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, readFile, rm } from "node:fs/promises";
import path from "node:path";

export default class ElectronDistribution {
  private static readonly PACKAGE_SEGMENTS: readonly string[] = ["node_modules", "electron"];
  private static readonly DISTRIBUTION_FOLDER: string = "dist";
  private static readonly MANIFEST_FILE: string = "package.json";
  private static readonly COPY_SEGMENTS: readonly string[] = ["_build", "package", "electron"];
  private static readonly DEFAULT_APP_FILE: string = "default_app.asar";
  private static readonly VERSION_FILE: string = "version";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get folder(): string {
    return path.join(this.root, ...ElectronDistribution.COPY_SEGMENTS);
  }

  public async readVersionAsync(): Promise<string> {
    const manifest = path.join(this.root, ...ElectronDistribution.PACKAGE_SEGMENTS, ElectronDistribution.MANIFEST_FILE);
    return String((JSON.parse(await readFile(manifest, "utf8")) as { readonly version: unknown }).version);
  }

  public async copyAsync(): Promise<void> {
    const source = path.join(this.root, ...ElectronDistribution.PACKAGE_SEGMENTS, ElectronDistribution.DISTRIBUTION_FOLDER);
    const version = path.join(source, ElectronDistribution.VERSION_FILE);
    await rm(this.folder, { recursive: true, force: true });
    await cp(source, this.folder, {
      recursive: true,
      verbatimSymlinks: true,
      filter: t => t !== version && path.basename(t) !== ElectronDistribution.DEFAULT_APP_FILE
    });
  }
}
