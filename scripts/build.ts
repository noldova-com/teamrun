/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import PackageCatalog from "./packages/package-catalog.ts";

export default class Build {
  private static readonly USAGE: string = "Usage: npm run build\n";
  private static readonly NO_PACKAGES: string = "No packages under src/; there is nothing to build.\n";
  private static readonly UNSUPPORTED: string = "The build cannot build packages yet. Found:\n";
  private static readonly USAGE_EXIT_CODE: number = 2;

  private readonly catalog: PackageCatalog;
  private readonly output: Writable;

  public constructor(catalog: PackageCatalog, output: Writable) {
    this.catalog = catalog;
    this.output = output;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    if (buildArguments.length > 0) {
      this.output.write(Build.USAGE);
      return Build.USAGE_EXIT_CODE;
    }

    const manifests = await this.catalog.listManifestsAsync();
    if (manifests.length === 0) {
      this.output.write(Build.NO_PACKAGES);
      return 0;
    }

    this.output.write(`${Build.UNSUPPORTED}${manifests.map(t => `  ${t}\n`).join("")}`);
    return 1;
  }
}

if (import.meta.main)
  process.exitCode = await new Build(new PackageCatalog(process.cwd()), process.stdout).runAsync(process.argv.slice(2));
