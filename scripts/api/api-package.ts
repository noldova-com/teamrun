/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type BuildLayout from "../packages/build-layout.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import ApiVisibility from "./api-visibility.ts";

export default class ApiPackage {
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly IMPLEMENTATION: readonly string[] = ["api", "index.ts"];
  private static readonly DECLARATIONS: readonly string[] = ["api", "index.d.ts"];
  private static readonly PART_EXAMPLE_ROOT: readonly string[] = ["node_modules", ".cache", "teamrun"];

  public readonly directory: string;
  public readonly id: string;
  public readonly project: string;
  public readonly implementation: string;
  public readonly declarations: string;
  public readonly sourceDeclarations: string;
  public readonly missingDeclarationsMessage: string;
  public readonly visibility: ApiVisibility;
  public readonly exampleRoot: string;
  public readonly paths?: Readonly<Record<string, readonly string[]>>;

  private constructor(directory: string, id: string, project: string, implementation: string, declarations: string, sourceDeclarations: string, missingDeclarationsMessage: string,
    visibility: ApiVisibility, exampleRoot: string, paths?: Readonly<Record<string, readonly string[]>>) {
    this.directory = directory;
    this.id = id;
    this.project = project;
    this.implementation = implementation;
    this.declarations = declarations;
    this.sourceDeclarations = sourceDeclarations;
    this.missingDeclarationsMessage = missingDeclarationsMessage;
    this.visibility = visibility;
    this.exampleRoot = exampleRoot;
    if (paths !== undefined)
      this.paths = paths;
  }

  public static forPackage(layout: BuildLayout, manifest: PackageManifest): ApiPackage {
    const declarations = path.join(layout.locateInstalled(manifest), ...ApiPackage.DECLARATIONS);
    return new ApiPackage(manifest.directory, manifest.id, layout.locateSource(manifest, ApiPackage.SOURCE_FOLDER, ApiPackage.PROJECT_FILE),
      layout.locateSource(manifest, ApiPackage.SOURCE_FOLDER, ...ApiPackage.IMPLEMENTATION), declarations,
      layout.locateSource(manifest, ApiPackage.SOURCE_FOLDER, ...ApiPackage.DECLARATIONS), `no installed declarations at ${declarations}; build the packages first`,
      ApiVisibility.PUBLIC_AND_PROTECTED, layout.root);
  }

  public static forPart(root: string, directory: string, project: string, paths: Readonly<Record<string, readonly string[]>>): ApiPackage {
    const declarations = ApiPackage.locatePartDeclarations(root, directory);
    return new ApiPackage(directory, directory.split("/").slice(1).join("-"), project, ApiPackage.locatePartImplementation(root, directory), declarations, declarations,
      `no declarations at ${declarations}`, ApiVisibility.PUBLIC, path.join(path.dirname(project), ...ApiPackage.PART_EXAMPLE_ROOT), paths);
  }

  public static locatePartImplementation(root: string, directory: string): string {
    return path.join(ApiPackage.locatePartSource(root, directory), ...ApiPackage.IMPLEMENTATION);
  }

  public static locatePartDeclarations(root: string, directory: string): string {
    return path.join(ApiPackage.locatePartSource(root, directory), ...ApiPackage.DECLARATIONS);
  }

  private static locatePartSource(root: string, directory: string): string {
    return path.join(root, ...directory.split("/"), ApiPackage.SOURCE_FOLDER);
  }
}
