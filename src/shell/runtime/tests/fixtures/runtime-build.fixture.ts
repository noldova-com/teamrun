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
import { RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

export class RuntimeBuildFixture implements AsyncDisposable {
  private readonly folder: string;

  public readonly identity: BuildIdentity;
  public readonly entryPath: string;

  private constructor(folder: string, identity: BuildIdentity, entryPath: string) {
    this.folder = folder;
    this.identity = identity;
    this.entryPath = entryPath;
  }

  public static async createAsync(productVersion: string): Promise<RuntimeBuildFixture> {
    const installed = path.resolve(path.dirname(RuntimeEntry.entryPath), "..");
    const folder = path.resolve(installed, "..", "..", "..", "_build", "runtime-builds", `${productVersion}-${process.pid}-${Date.now()}`);
    const copy = path.join(folder, "node_modules", "@noldova", "teamrun-shell-runtime");
    await cp(installed, copy, { recursive: true });
    const identity = new BuildIdentity(productVersion, RuntimeBuild.identity.protocolVersion, `${RuntimeBuild.identity.fingerprint}-${productVersion}`);
    const resources = path.join(copy, "resources.js");
    const text = (await readFile(resources, "utf8"))
      .replace(`productVersion = "${RuntimeBuild.identity.productVersion}"`, `productVersion = "${identity.productVersion}"`)
      .replace(`build = "${RuntimeBuild.identity.fingerprint}"`, `build = "${identity.fingerprint}"`);
    await writeFile(resources, text);
    await mkdir(path.join(folder, "_build", "modules"), { recursive: true });
    await writeFile(path.join(folder, "_build", "modules", "declarations.json"), "{\"formatVersion\":1,\"modules\":[]}\n");
    return new RuntimeBuildFixture(folder, identity, path.join(copy, "services", "runtime-entry.js"));
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
