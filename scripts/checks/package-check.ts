/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type PackageCatalog from "../packages/package-catalog.ts";
import type ICheck from "./interfaces/check.ts";

export default class PackageCheck implements ICheck {
  private static readonly NO_PACKAGES: string = "No packages under src/; there are no package tests to run.\n";
  private static readonly UNSUPPORTED: string = "The tests cannot test packages yet. Found:\n";

  private readonly catalog: PackageCatalog;

  public readonly title: string = "Packages";

  public constructor(catalog: PackageCatalog) {
    this.catalog = catalog;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const manifests = await this.catalog.listManifestsAsync();
    if (manifests.length === 0) {
      output.write(PackageCheck.NO_PACKAGES);
      return true;
    }

    output.write(`${PackageCheck.UNSUPPORTED}${manifests.map(t => `  ${t}\n`).join("")}`);
    return false;
  }
}
