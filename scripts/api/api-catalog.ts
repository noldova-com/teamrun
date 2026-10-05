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

import type BuildLayout from "../packages/build-layout.ts";
import type PackageCatalog from "../packages/package-catalog.ts";
import ApiPackage from "./api-package.ts";
import ApiException from "./api.exception.ts";

export default class ApiCatalog {
  private static readonly PROJECT: readonly string[] = ["src", "tsconfig.json"];
  private static readonly DEPENDENCIES: readonly string[] = ["node_modules", "*"];
  private static readonly ANY_MODULE: string = "*";
  private static readonly ENCODING: BufferEncoding = "utf8";

  private readonly root: string;
  private readonly packages: PackageCatalog;
  private readonly layout: BuildLayout;
  private readonly parts: readonly string[];

  public constructor(root: string, packages: PackageCatalog, layout: BuildLayout, parts: readonly string[]) {
    this.root = root;
    this.packages = packages;
    this.layout = layout;
    this.parts = [...parts];
  }

  public async listAsync(): Promise<readonly ApiPackage[]> {
    const packages = (await this.packages.listPackagesAsync(false)).map(t => ApiPackage.forPackage(this.layout, t));
    const project = path.join(this.root, ...ApiCatalog.PROJECT);
    if (this.parts.length === 0 || !existsSync(project))
      return packages;
    const paths = await this.readPathsAsync(project);
    return [...packages, ...this.parts.map(t => ApiPackage.forPart(this.root, t, project, paths))];
  }

  private static async readAliasesAsync(project: string): Promise<ReadonlyMap<string, readonly string[]>> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(project, ApiCatalog.ENCODING));
    }
    catch (error) {
      throw new ApiException(`${project} could not be read as JSON.`, { cause: error });
    }
    const paths = ApiCatalog.field(ApiCatalog.field(parsed, "compilerOptions"), "paths");
    const aliases = typeof paths === "object" && paths !== null && !Array.isArray(paths) ? Object.entries(paths) : null;
    if (aliases === null || !aliases.every(([, targets]) => Array.isArray(targets) && targets.every(t => typeof t === "string")))
      throw new ApiException(`${project} must map its path aliases to lists of files in compilerOptions.paths.`);
    return new Map(aliases as [string, string[]][]);
  }

  private static field(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
  }

  private async readPathsAsync(project: string): Promise<Readonly<Record<string, readonly string[]>>> {
    const folder = path.dirname(project);
    const declared = new Map(this.parts.map(t => ApiPackage.locatePart(this.root, t)));
    const paths: Record<string, readonly string[]> = {};
    for (const [alias, targets] of await ApiCatalog.readAliasesAsync(project))
      paths[alias] = targets.map(t => {
        const target = path.resolve(folder, t);
        return declared.get(target) ?? target;
      });
    paths[ApiCatalog.ANY_MODULE] = [path.join(folder, ...ApiCatalog.DEPENDENCIES)];
    return paths;
  }
}
