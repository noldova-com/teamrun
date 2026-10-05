/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type AngularProject from "../angular/angular-project.ts";
import type BuildLayout from "../packages/build-layout.ts";
import type PackageCatalog from "../packages/package-catalog.ts";
import PackageException from "../packages/package.exception.ts";
import ProcessException from "../processes/process.exception.ts";
import ApiPackage from "./api-package.ts";
import ApiException from "./api.exception.ts";

export default class ApiCatalog {
  private readonly root: string;
  private readonly packages: PackageCatalog;
  private readonly layout: BuildLayout;
  private readonly angular: AngularProject;
  private readonly parts: readonly string[];

  public constructor(root: string, packages: PackageCatalog, layout: BuildLayout, angular: AngularProject, parts: readonly string[]) {
    this.root = root;
    this.packages = packages;
    this.layout = layout;
    this.angular = angular;
    this.parts = [...parts];
  }

  public async listAsync(): Promise<readonly ApiPackage[]> {
    const packages = (await this.packages.listPackagesAsync(false)).map(t => ApiPackage.forPackage(this.layout, t));
    if (this.parts.length === 0)
      return packages;
    const paths = await this.readPathsAsync();
    return [...packages, ...this.parts.map(t => ApiPackage.forPart(this.root, t, this.angular.projectFile, paths))];
  }

  public async listOrReportAsync(output: Writable): Promise<readonly ApiPackage[] | undefined> {
    try {
      return await this.listAsync();
    }
    catch (error) {
      if (!(error instanceof ApiException || error instanceof ProcessException || error instanceof PackageException))
        throw error;
      output.write(`${error.message}\n`);
      return undefined;
    }
  }

  private async readPathsAsync(): Promise<Readonly<Record<string, readonly string[]>>> {
    const aliases = await this.angular.readPathAliasesAsync();
    const targets = new Set([...aliases.values()].flat());
    const declared = new Map<string, string>();
    for (const part of this.parts) {
      const implementation = ApiPackage.locatePartImplementation(this.root, part);
      if (!targets.has(implementation))
        throw new ApiException(`No path alias in ${this.angular.projectName} leads to ${part}/src/api/index.ts, so the examples of ${part} cannot be compiled against its declarations.`);
      declared.set(implementation, ApiPackage.locatePartDeclarations(this.root, part));
    }
    const paths: Record<string, readonly string[]> = {};
    for (const [alias, files] of aliases)
      paths[alias] = files.map(t => declared.get(t) ?? t);
    return paths;
  }
}
