/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, cp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type AngularProject from "../angular/angular-project.ts";
import GalleryFile from "../angular/gallery-file.ts";
import ModuleCatalog from "../modules/module-catalog.ts";
import BuildLayout from "../packages/build-layout.ts";
import PackageCatalog from "../packages/package-catalog.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import PackageVersions from "../packages/package-versions.ts";
import RootManifest from "../packages/root-manifest.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import type NpmCommand from "../toolchain/npm-command.ts";
import PackagingException from "./packaging.exception.ts";

export default class PackageStage {
  private static readonly STAGE_SEGMENTS: readonly string[] = ["_build", "package", "app"];
  private static readonly CACHE_SEGMENTS: readonly string[] = ["_build", "package", "npm-cache"];
  private static readonly BUILD_FOLDER: string = "_build";
  private static readonly WINDOW_FOLDER: string = "window";
  private static readonly DECLARATIONS_SEGMENTS: readonly string[] = ["modules", "declarations.json"];
  private static readonly BUILD_SCRIPT_SEGMENTS: readonly string[] = ["scripts", "build.ts"];
  private static readonly BUILD_OPTIONS: readonly string[] = ["--packaged", "--output"];
  private static readonly ENTRY_PACKAGES: readonly string[] = ["@noldova/teamrun-shell-desktop", "@noldova/teamrun-shell-cli"];
  private static readonly MAIN: string = "node_modules/@noldova/teamrun-shell-desktop/main.js";
  private static readonly MANIFEST_FILE: string = "package.json";
  private static readonly LICENSE_FILE: string = "LICENSE";
  private static readonly DESKTOP_FILE_EXTENSION: string = ".desktop";
  private static readonly UNREACHABLE_REGISTRY: string = "http://127.0.0.1:9/";
  private static readonly INSTALL_ARGUMENTS: readonly string[] = [
    "install", "--offline", "--no-save", "--no-package-lock", "--omit=dev", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error",
    `--registry=${PackageStage.UNREACHABLE_REGISTRY}`, "--cache"
  ];

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;
  private readonly gallery: GalleryFile;
  private readonly angular: AngularProject;

  public constructor(root: string, runner: ProcessRunner, npm: NpmCommand, gallery: GalleryFile, angular: AngularProject) {
    this.root = root;
    this.runner = runner;
    this.npm = npm;
    this.gallery = gallery;
    this.angular = angular;
  }

  public get folder(): string {
    return path.join(this.root, ...PackageStage.STAGE_SEGMENTS);
  }

  public async stageAsync(output: Writable): Promise<void> {
    const cache = path.join(this.root, ...PackageStage.CACHE_SEGMENTS);
    await rm(this.folder, { recursive: true, force: true });
    await rm(cache, { recursive: true, force: true });
    const buildFolder = path.join(this.folder, PackageStage.BUILD_FOLDER);
    await this.buildAsync(buildFolder);
    await this.angular.verifyWithoutAsync(path.join(buildFolder, PackageStage.WINDOW_FOLDER), GalleryFile.MARKERS);
    output.write("The packaged window holds no Gallery.\n");

    const manifest = await RootManifest.readAsync(this.root);
    const packages = await this.listShippedAsync(buildFolder);
    const versions = await PackageVersions.readAsync(new ModuleCatalog(this.root), manifest.productVersion, packages);
    const product = manifest.product;
    await writeFile(path.join(this.folder, PackageStage.MANIFEST_FILE), `${JSON.stringify({
      name: product.slug,
      productName: product.name,
      version: manifest.productVersion,
      author: product.publisher,
      desktopName: `${product.applicationId}${PackageStage.DESKTOP_FILE_EXTENSION}`,
      private: true,
      main: PackageStage.MAIN,
      dependencies: Object.fromEntries(packages.map(t => [t.name, versions.of(t.name)]))
    }, null, 2)}\n`);
    const layout = new BuildLayout(this.root);
    const result = await this.npm.runAsync([...PackageStage.INSTALL_ARGUMENTS, cache, ...packages.map(t => layout.locateArchive(t, versions.of(t.name)))], this.folder);
    if (!result.isSuccessful)
      throw new PackagingException(`Installing the packages into the stage failed with exit code ${result.exitCode}; it uses only the build's archives and never the registry:\n${`${result.output}${result.errorOutput}`.trim()}`);
    output.write(`Packages in the stage: ${packages.map(t => t.name).join(", ")}.\n`);

    await cp(path.join(this.root, product.icons), path.join(this.folder, product.icons), { recursive: true });
    await copyFile(path.join(this.root, PackageStage.LICENSE_FILE), path.join(this.folder, PackageStage.LICENSE_FILE));
  }

  private async buildAsync(buildFolder: string): Promise<void> {
    let exitCode: number | null;
    try {
      exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...PackageStage.BUILD_SCRIPT_SEGMENTS), ...PackageStage.BUILD_OPTIONS, buildFolder], this.root);
    }
    finally {
      await this.gallery.writeAsync(false);
    }
    if (exitCode !== 0)
      throw new PackagingException(`The packaged build failed with exit code ${exitCode}.`);
  }

  private async listShippedAsync(buildFolder: string): Promise<readonly PackageManifest[]> {
    const declarations = JSON.parse(await readFile(path.join(buildFolder, ...PackageStage.DECLARATIONS_SEGMENTS), "utf8")) as { readonly modules: readonly { readonly runtimePackage: string | null }[] };
    const roots = [...PackageStage.ENTRY_PACKAGES, ...declarations.modules.flatMap(t => t.runtimePackage === null ? [] : [t.runtimePackage])];
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
