/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { ProductInfo, RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

export class RuntimeBuildFixture implements AsyncDisposable {
  private readonly folder: string;

  public readonly identity: BuildIdentity;
  public readonly entryPath: string;

  private constructor(folder: string, identity: BuildIdentity, entryPath: string) {
    this.folder = folder;
    this.identity = identity;
    this.entryPath = entryPath;
  }

  public static async createWithModuleAsync(productVersion: string, moduleId: string, method: string, runtimePart: string): Promise<RuntimeBuildFixture> {
    const build = await RuntimeBuildFixture.createAsync(productVersion);
    const runtimePackage = `@noldova/teamrun-fixture-${moduleId}-runtime`;
    const packageFolder = path.join(build.folder, "node_modules", runtimePackage);
    await mkdir(packageFolder, { recursive: true });
    await writeFile(path.join(packageFolder, "package.json"), JSON.stringify({ name: runtimePackage, version: productVersion, type: "module", main: "index.js" }));
    await writeFile(path.join(packageFolder, "index.js"), runtimePart);
    const declaration = { id: moduleId, displayName: moduleId, description: moduleId, dependencies: [], runtimePackage, contributes: { methods: [method] } };
    await writeFile(path.join(build.folder, "_build", "modules", "declarations.json"), JSON.stringify({ formatVersion: 1, modules: [declaration] }));
    return build;
  }

  public static async createAsync(productVersion: string): Promise<RuntimeBuildFixture> {
    const installed = path.resolve(path.dirname(RuntimeEntry.entryPath), "..");
    const folder = path.resolve(installed, "..", "..", "..", "_build", "runtime-builds", `${productVersion}-${process.pid}-${Date.now()}`);
    const copy = path.join(folder, "node_modules", "@noldova", "teamrun-shell-runtime");
    await cp(installed, copy, { recursive: true });
    const identity = new BuildIdentity(productVersion, RuntimeBuild.identity.protocolVersion, `${RuntimeBuild.identity.fingerprint}-${productVersion}`);
    await mkdir(path.join(folder, "_build", "modules"), { recursive: true });
    const product = { ...JSON.parse(await readFile(ProductInfo.file, "utf8")), version: identity.productVersion, build: identity.fingerprint };
    await writeFile(path.join(folder, "_build", "product.json"), JSON.stringify(product));
    await writeFile(path.join(folder, "_build", "modules", "declarations.json"), "{\"formatVersion\":1,\"modules\":[]}\n");
    return new RuntimeBuildFixture(folder, identity, path.join(copy, "services", "runtime-entry.js"));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
