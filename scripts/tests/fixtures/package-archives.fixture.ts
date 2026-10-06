/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ProcessRunner from "../../processes/process-runner.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import type IFixturePackage from "./interfaces/fixture-package.ts";
import ProductIdentityFixture from "./product-identity.fixture.ts";
import type RepositoryFixture from "./repository.fixture.ts";

export default class PackageArchivesFixture {
  private static readonly PREFIX: string = "teamrun-package-archives-";
  private static readonly BETA: IFixturePackage = { directory: "src/foundation/beta", name: "@noldova/teamrun-foundation-beta", version: "0.0.7", dependencies: [], peers: {} };
  private static readonly PACKAGES: readonly IFixturePackage[] = [
    PackageArchivesFixture.BETA,
    { directory: "src/foundation/alpha", name: "@noldova/teamrun-foundation-alpha", version: "0.0.7", dependencies: ["@noldova/teamrun-foundation-beta"], peers: {} },
    { directory: "src/foundation/testing", name: "@noldova/teamrun-foundation-testing", version: "0.0.7", dependencies: [], peers: {} },
    { directory: "src/shell/cli", name: "@noldova/teamrun-shell-cli", version: "0.0.7", dependencies: ["@noldova/teamrun-foundation-alpha"], peers: {} },
    { directory: "src/shell/desktop", name: "@noldova/teamrun-shell-desktop", version: "0.0.7", dependencies: ["@noldova/teamrun-foundation-alpha"], peers: { electron: "44.5.1" } },
    { directory: "src/modules/tasks/runtime", name: "@noldova/teamrun-modules-tasks-runtime", version: "0.3.0", dependencies: ["@noldova/teamrun-foundation-beta"], peers: {} }
  ];
  private static readonly SHIPPED: string = "shipped";
  private static readonly OUTSIDE: string = "outside";

  private readonly folder: string;

  private constructor(folder: string) {
    this.folder = folder;
  }

  public static async createAsync(): Promise<PackageArchivesFixture> {
    const fixture = new PackageArchivesFixture(await mkdtemp(path.join(tmpdir(), PackageArchivesFixture.PREFIX)));
    await Promise.all([
      ...PackageArchivesFixture.PACKAGES.map(t => fixture.packAsync(t, PackageArchivesFixture.SHIPPED, {})),
      fixture.packAsync(PackageArchivesFixture.BETA, PackageArchivesFixture.OUTSIDE, { "left-pad": "1.3.0" })
    ]);
    return fixture;
  }

  public async writeSourcesAsync(repository: RepositoryFixture, modules: readonly string[], hasOutsideDependency: boolean = false): Promise<void> {
    await repository.writeAsync({
      "package.json": JSON.stringify(ProductIdentityFixture.manifest({}, modules)),
      "LICENSE": "Fixture license\n",
      "assets/fixture-icons/icon-dark.ico": "ico\n",
      "assets/dictionaries/dictionaries.json": "{\"dictionaries\":[]}\n",
      "src/angular.json": "{}\n",
      "src/modules/tasks/module.json": JSON.stringify({ id: "tasks", version: "0.3.0", displayName: "Tasks", description: "Used by the tests.", parts: ["runtime"], dependencies: [], contributes: {} }),
      ...Object.fromEntries(PackageArchivesFixture.PACKAGES.map(t => [`${t.directory}/package.json`, JSON.stringify({
        name: t.name,
        version: "__VERSION__",
        dependencies: Object.fromEntries(t.dependencies.map(u => [u, "__VERSION__"]))
      })]))
    });
    const target = path.join(repository.directory, "_build", "archives");
    await cp(path.join(this.folder, PackageArchivesFixture.SHIPPED), target, { recursive: true });
    if (hasOutsideDependency)
      await cp(path.join(this.folder, PackageArchivesFixture.OUTSIDE), target, { recursive: true });
  }

  public disposeAsync(): Promise<void> {
    return rm(this.folder, { recursive: true, force: true });
  }

  private async packAsync(fixture: IFixturePackage, variant: string, outside: Readonly<Record<string, string>>): Promise<void> {
    const archives = path.join(this.folder, variant);
    const packed = path.join(this.folder, "packed", variant, fixture.name.split("/").join("-"));
    await mkdir(packed, { recursive: true });
    await mkdir(archives, { recursive: true });
    const versions = new Map(PackageArchivesFixture.PACKAGES.map(t => [t.name, t.version]));
    const dependencies = { ...Object.fromEntries(fixture.dependencies.map(t => [t, String(versions.get(t))])), ...outside };
    await writeFile(path.join(packed, "package.json"), JSON.stringify({ name: fixture.name, version: fixture.version, main: "index.js", dependencies, peerDependencies: fixture.peers }));
    await writeFile(path.join(packed, "index.js"), "export {};\n");
    const result = await new NpmCommand(new ProcessRunner(), process.env).runAsync(["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", archives], packed);
    assert.ok(result.isSuccessful, result.errorOutput);
  }
}
