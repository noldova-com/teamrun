/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, cp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import Start from "../desktop/start.ts";
import ModuleCatalog from "../modules/module-catalog.ts";
import BuildLayout from "../packages/build-layout.ts";
import PackageCatalog from "../packages/package-catalog.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import PackageVersions from "../packages/package-versions.ts";
import RootManifest from "../packages/root-manifest.ts";
import type NpmCommand from "../toolchain/npm-command.ts";
import PackageLayout from "./package-layout.ts";
import type PackagedBuild from "./packaged-build.ts";
import PackagingException from "./packaging.exception.ts";

export default class PackageStage {
  private static readonly BUILD_FOLDER: string = "_build";
  private static readonly ENTRY_PACKAGES: readonly string[] = ["@noldova/teamrun-shell-desktop", "@noldova/teamrun-shell-cli"];
  private static readonly MANIFEST_FILE: string = "package.json";
  private static readonly LICENSE_FILE: string = "LICENSE";
  private static readonly DESKTOP_FILE_EXTENSION: string = ".desktop";
  private static readonly UNREACHABLE_REGISTRY: string = "http://127.0.0.1:9/";
  private static readonly INSTALL_ARGUMENTS: readonly string[] = [
    "install", "--offline", "--no-save", "--no-package-lock", "--omit=dev", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error",
    `--registry=${PackageStage.UNREACHABLE_REGISTRY}`, "--cache"
  ];

  private readonly root: string;
  private readonly layout: PackageLayout;
  private readonly modules: ModuleCatalog;
  private readonly npm: NpmCommand;
  private readonly build: PackagedBuild;

  public constructor(root: string, npm: NpmCommand, build: PackagedBuild) {
    this.root = root;
    this.layout = new PackageLayout(root);
    this.modules = new ModuleCatalog(root);
    this.npm = npm;
    this.build = build;
  }

  public get folder(): string {
    return this.layout.stage;
  }

  public async stageAsync(output: Writable): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
    await rm(this.layout.npmCache, { recursive: true, force: true });
    await this.build.buildAsync(path.join(this.folder, PackageStage.BUILD_FOLDER));
    output.write("The packaged window holds no Gallery.\n");

    const manifest = await RootManifest.readAsync(this.root);
    const packages = await this.listShippedAsync();
    const versions = await PackageVersions.readAsync(this.modules, manifest.productVersion, packages);
    const product = manifest.product;
    await writeFile(path.join(this.folder, PackageStage.MANIFEST_FILE), `${JSON.stringify({
      name: product.slug,
      productName: product.name,
      version: manifest.productVersion,
      author: product.publisher,
      desktopName: `${product.applicationId}${PackageStage.DESKTOP_FILE_EXTENSION}`,
      private: true,
      main: path.posix.join(...Start.MAIN_SEGMENTS),
      dependencies: Object.fromEntries(packages.map(t => [t.name, versions.of(t.name)]))
    }, null, 2)}\n`);
    const archives = new BuildLayout(this.root);
    const result = await this.npm.runAsync([...PackageStage.INSTALL_ARGUMENTS, this.layout.npmCache, ...packages.map(t => archives.locateArchive(t, versions.of(t.name)))], this.folder);
    if (!result.isSuccessful)
      throw new PackagingException(`Installing the packages into the stage failed with exit code ${result.exitCode}; it uses only the build's archives and never the registry:\n${`${result.output}${result.errorOutput}`.trim()}`);
    output.write(`Packages in the stage: ${packages.map(t => t.name).join(", ")}.\n`);

    await cp(path.join(this.root, product.icons), path.join(this.folder, product.icons), { recursive: true });
    await copyFile(path.join(this.root, PackageStage.LICENSE_FILE), path.join(this.folder, PackageStage.LICENSE_FILE));
  }

  private async listShippedAsync(): Promise<readonly PackageManifest[]> {
    const declarations = await this.modules.listBuildAsync(false, []);
    const roots = [...PackageStage.ENTRY_PACKAGES, ...declarations.flatMap(t => t.runtimePackage === null ? [] : [t.runtimePackage])];
    const packages = await new PackageCatalog(this.root).listPackagesAsync(false);
    const missing = roots.filter(t => !packages.some(u => u.name === t));
    if (missing.length > 0)
      throw new PackagingException(`The stage needs ${missing.join(", ")}, which is not a package under src/.`);
    const shipped = new Set<string>(roots);
    for (const manifest of [...packages].reverse())
      if (shipped.has(manifest.name))
        manifest.dependencies.forEach(t => shipped.add(t));
    return packages.filter(t => shipped.has(t.name));
  }
}
