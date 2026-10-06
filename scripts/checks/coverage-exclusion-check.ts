/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import PackageException from "../packages/package.exception.ts";
import type PackageCatalog from "../packages/package-catalog.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import type ICheck from "./interfaces/check.ts";

export default class CoverageExclusionCheck implements ICheck {
  private static readonly CONTRACT_FILE: string = "docs/TESTING.md";
  private static readonly TABLE_HEADER: string = "| Scope | Requirement |";
  private static readonly TABLE_ROW_PREFIX: string = "|";
  private static readonly ROW_START: string = "| ";
  private static readonly ROW_END: string = " |";
  private static readonly CELL_SEPARATOR: string = " | ";
  private static readonly SCOPE: RegExp = /^`([^`]+)`$/;
  private static readonly CODE_SPAN: RegExp = /`[^`]+`/g;
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly UNREADABLE: string = `${CoverageExclusionCheck.CONTRACT_FILE}: section 5's coverage table, headed "${CoverageExclusionCheck.TABLE_HEADER}", could not be read, so no coverage exclusion can be granted.`;

  private readonly root: string;
  private readonly catalog: PackageCatalog;

  public readonly title: string = "Coverage exclusions";

  public constructor(root: string, catalog: PackageCatalog) {
    this.root = root;
    this.catalog = catalog;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const grants = await this.readGrantsAsync();
    if (grants === null) {
      output.write(`${CoverageExclusionCheck.UNREADABLE}\n`);
      return false;
    }

    let packages: readonly PackageManifest[];
    try {
      packages = await this.catalog.listPackagesAsync(true);
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }

    const findings: string[] = [];
    let exclusions = 0;
    for (const manifest of packages)
      for (const file of CoverageExclusionCheck.readFiles(manifest.coverageExclusions)) {
        exclusions++;
        if (!(grants.get(manifest.directory)?.has(file) ?? false))
          findings.push(`${manifest.directory}/package.json: excludes ${file} from coverage, which ${CoverageExclusionCheck.CONTRACT_FILE} section 5's table does not grant; only that table grants an exclusion.`);
      }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${exclusions} coverage exclusions in ${packages.length} packages against ${CoverageExclusionCheck.CONTRACT_FILE} section 5.\n`);
    return findings.length === 0;
  }

  private static readFiles(exclusions: string): readonly string[] {
    const entries: unknown[] = JSON.parse(exclusions);
    return entries.flatMap(t => typeof t === "object" && t !== null && "file" in t && typeof t.file === "string" ? [t.file] : []);
  }

  private async readGrantsAsync(): Promise<ReadonlyMap<string, ReadonlySet<string>> | null> {
    const file = path.join(this.root, CoverageExclusionCheck.CONTRACT_FILE);
    if (!existsSync(file))
      return null;
    const lines = (await readFile(file, "utf8")).split(CoverageExclusionCheck.LINE_SEPARATOR);
    const start = lines.indexOf(CoverageExclusionCheck.TABLE_HEADER);
    if (start === -1)
      return null;

    const grants = new Map<string, ReadonlySet<string>>();
    let rows = 0;
    for (const line of lines.slice(start + 2)) {
      if (!line.startsWith(CoverageExclusionCheck.TABLE_ROW_PREFIX))
        break;
      const separator = line.indexOf(CoverageExclusionCheck.CELL_SEPARATOR);
      if (separator === -1 || !line.endsWith(CoverageExclusionCheck.ROW_END))
        return null;
      rows++;
      const scope = CoverageExclusionCheck.SCOPE.exec(line.slice(CoverageExclusionCheck.ROW_START.length, separator))?.[1];
      const requirement = line.slice(separator + CoverageExclusionCheck.CELL_SEPARATOR.length, -CoverageExclusionCheck.ROW_END.length);
      if (scope !== undefined)
        grants.set(scope, new Set([...requirement.matchAll(CoverageExclusionCheck.CODE_SPAN)].map(t => t[0].slice(1, -1))));
    }
    return rows === 0 ? null : grants;
  }
}
