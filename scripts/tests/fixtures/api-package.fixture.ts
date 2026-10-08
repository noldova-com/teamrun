/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import AngularProject from "../../angular/angular-project.ts";
import ApiCatalog from "../../api/api-catalog.ts";
import BuildLayout from "../../packages/build-layout.ts";
import PackageCatalog from "../../packages/package-catalog.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import SourceTreeFixture from "./source-tree.fixture.ts";

export default class ApiPackageFixture {
  private static readonly PREFIX: string = "teamrun-api-fixture-";

  public readonly directory: string;

  private constructor(directory: string) {
    this.directory = directory;
  }

  public static async createAsync(): Promise<ApiPackageFixture> {
    return new ApiPackageFixture(await mkdtemp(path.join(tmpdir(), ApiPackageFixture.PREFIX)));
  }

  public async writePackageAsync(id: string, implementation: Readonly<Record<string, string>>, declarations: string | null): Promise<string> {
    const source = `src/foundation/${id}`;
    const name = PackageManifest.formatName(source);
    const project = { extends: path.join(SourceTreeFixture.root, "tsconfig.base.json"), compilerOptions: { types: [] } };
    const files: Record<string, string> = {
      [`${source}/package.json`]: `${JSON.stringify({ name, version: "__VERSION__", type: "module", types: "api/index.d.ts" }, null, 2)}\n`,
      [`${source}/src/tsconfig.json`]: `${JSON.stringify(project, null, 2)}\n`,
      ...Object.fromEntries(Object.entries(implementation).map(([file, text]) => [`${source}/src/${file}`, text]))
    };
    if (declarations !== null) {
      files[`node_modules/${name}/package.json`] = `${JSON.stringify({ name, types: "api/index.d.ts" })}\n`;
      files[`node_modules/${name}/api/index.d.ts`] = declarations;
    }
    await this.writeFilesAsync(files);
    return `${source}/package.json`;
  }

  public async writePartAsync(directory: string, implementation: Readonly<Record<string, string>>, declarations: string | null): Promise<string> {
    const alias = PackageManifest.formatName(directory);
    const project = {
      extends: path.join(SourceTreeFixture.root, "tsconfig.base.json"),
      compilerOptions: { types: [], module: "preserve", moduleResolution: "bundler", paths: { [alias]: [`./${directory.split("/").slice(1).join("/")}/src/api/index.ts`] } }
    };
    const files: Record<string, string> = {
      "src/tsconfig.json": `${JSON.stringify(project, null, 2)}\n`,
      ...Object.fromEntries(Object.entries(implementation).map(([file, text]) => [`${directory}/src/${file}`, text]))
    };
    if (declarations !== null)
      files[`${directory}/src/api/index.d.ts`] = declarations;
    await this.writeFilesAsync(files);
    return alias;
  }

  public createCatalog(parts: readonly string[]): ApiCatalog {
    const runner = new ProcessRunner();
    const angular = new AngularProject(this.directory, runner, new NpmCommand(runner, {}));
    return new ApiCatalog(this.directory, new PackageCatalog(this.directory), new BuildLayout(this.directory), angular, parts);
  }

  public async writeFilesAsync(files: Readonly<Record<string, string>>): Promise<void> {
    for (const [file, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(this.directory, file)), { recursive: true });
      await writeFile(path.join(this.directory, file), text);
    }
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}
