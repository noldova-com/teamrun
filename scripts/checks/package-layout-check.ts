/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import type PackageCatalog from "../packages/package-catalog.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import PackageException from "../packages/package.exception.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class PackageLayoutCheck implements ICheck {
  private static readonly REQUIRED: readonly string[] = ["src/tsconfig.json", "src/resources.ts", "tests/tsconfig.json"];
  private static readonly SEPARATOR: string = "/";
  private static readonly RULE: string = "CODING-STANDARDS.md section 5 puts package.json at the package root, with src/ and tests/ beside it, each with its own tsconfig.json, and resources.ts at the root of src/.";

  private readonly root: string;
  private readonly catalog: PackageCatalog;

  public readonly title: string = "Package layout";

  public constructor(root: string, catalog: PackageCatalog) {
    this.root = root;
    this.catalog = catalog;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let packages: readonly PackageManifest[];
    try {
      packages = await this.catalog.listPackagesAsync(false);
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }

    const directories = packages.map(t => t.directory);
    const findings = packages.flatMap(t => [
      ...PackageLayoutCheck.REQUIRED.filter(u => !existsSync(path.join(this.root, t.directory, u))).map(u => `${t.directory}: has no ${u}; ${PackageLayoutCheck.RULE}`),
      ...directories.filter(u => t.directory.startsWith(`${u}${PackageLayoutCheck.SEPARATOR}`)).map(u => `${t.directory}: lies inside the package ${u}; ${PackageLayoutCheck.RULE}`)
    ]);

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked the layout of ${packages.length} packages; test fixture packages follow CODING-STANDARDS.md section 13 instead.\n`);
    return findings.length === 0;
  }
}
