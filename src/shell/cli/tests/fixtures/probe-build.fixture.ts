/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, Wait } from "@noldova/teamrun-foundation-testing";
import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, ProductInfo, RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

export class ProbeBuildFixture implements AsyncDisposable {
  private static readonly WAITING_MARKER: string = "waiting";
  private static readonly RELEASE_MARKER: string = "released";
  private static readonly WAIT_LIMIT: number = 15_000;
  private static readonly PROBE_PART: string = [
    "import { existsSync, writeFileSync } from \"node:fs\";",
    "import { writeFile } from \"node:fs/promises\";",
    "import path from \"node:path\";",
    "import { RuntimeCommand } from \"@noldova/teamrun-shell-runtime\";",
    "export class RuntimePart {",
    "  migrations = [];",
    "  async activateAsync(context) {",
    "    context.registerCommand(new RuntimeCommand(\"probe.block\", \"Block\", null, null, {",
    `      handleAsync: async () => { writeFileSync(path.join(context.moduleFolder, "${ProbeBuildFixture.WAITING_MARKER}"), "yes");`,
    `        const pause = new Int32Array(new SharedArrayBuffer(4)); const deadline = Date.now() + ${ProbeBuildFixture.WAIT_LIMIT};`,
    `        while (!existsSync(path.join(context.moduleFolder, "${ProbeBuildFixture.RELEASE_MARKER}"))) {`,
    `          if (Date.now() > deadline) throw new Error("The probe's block was not released within ${ProbeBuildFixture.WAIT_LIMIT} ms.");`,
    "          Atomics.wait(pause, 0, 0, 20); }",
    "        return null; }",
    "    }));",
    "    context.registerCommand(new RuntimeCommand(\"probe.echo\", \"Echo\", null, null, { handleAsync: async t => t.payload }));",
    "    context.registerCommand(new RuntimeCommand(\"probe.fail\", \"Fail\", null, null, {",
    "      handleAsync: async () => { throw new Error(\"The probe broke.\"); }",
    "    }));",
    "    context.registerCommand(new RuntimeCommand(\"probe.wait\", \"Wait\", null, null, {",
    `      handleAsync: async t => { await writeFile(path.join(context.moduleFolder, "${ProbeBuildFixture.WAITING_MARKER}"), "yes");`,
    "        await new Promise(resolve => t.signal.addEventListener(\"abort\", resolve)); return null; }",
    "    }));",
    "  }",
    "  async deactivateAsync() {}",
    "}"
  ].join("\n");

  private readonly folder: string;

  public readonly identity: BuildIdentity;
  public readonly entryPath: string;
  public readonly declarationsFile: string;

  private constructor(folder: string, identity: BuildIdentity, entryPath: string, declarationsFile: string) {
    this.folder = folder;
    this.identity = identity;
    this.entryPath = entryPath;
    this.declarationsFile = declarationsFile;
  }

  public static async createAsync(productVersion: string): Promise<ProbeBuildFixture> {
    const installed = path.resolve(path.dirname(RuntimeEntry.entryPath), "..");
    const folder = path.resolve(installed, "..", "..", "..", "_build", "cli-test-builds", `${productVersion}-${process.pid}-${Date.now()}`);
    const copy = path.join(folder, "node_modules", "@noldova", "teamrun-shell-runtime");
    await cp(installed, copy, { recursive: true });
    const identity = new BuildIdentity(productVersion, RuntimeBuild.identity.protocolVersion, `${RuntimeBuild.identity.fingerprint}-${productVersion}`);
    const probe = path.join(folder, "probe.mjs");
    await writeFile(probe, ProbeBuildFixture.PROBE_PART);
    const modules = path.join(folder, "_build", "modules");
    await mkdir(modules, { recursive: true });
    const product = { ...JSON.parse(await readFile(ProductInfo.file, "utf8")), version: identity.productVersion, build: identity.fingerprint };
    await writeFile(path.join(folder, "_build", "product.json"), JSON.stringify(product));
    const declaration = { id: "probe", version: "0.0.1", displayName: "Probe", description: "Answers the command line tests.", dependencies: [], runtimePackage: pathToFileURL(probe).href, contributes: { commands: ["probe.block", "probe.echo", "probe.fail", "probe.wait"] } };
    const declarationsFile = path.join(modules, "declarations.json");
    await writeFile(declarationsFile, JSON.stringify({ formatVersion: 1, modules: [declaration] }));
    return new ProbeBuildFixture(folder, identity, path.join(copy, "services", "runtime-entry.js"), declarationsFile);
  }

  public static markerPath(dataDirectory: string): string {
    return path.join(new DataDirectory(dataDirectory).locateModuleFolder("probe"), ProbeBuildFixture.WAITING_MARKER);
  }

  public static releasePath(dataDirectory: string): string {
    return path.join(new DataDirectory(dataDirectory).locateModuleFolder("probe"), ProbeBuildFixture.RELEASE_MARKER);
  }

  public static async waitUntilWaitingAsync(marker: string): Promise<void> {
    Assert.isTrue(await Wait.untilAsync(() => existsSync(marker), ProbeBuildFixture.WAIT_LIMIT),
      `The probe's command did not start waiting within ${ProbeBuildFixture.WAIT_LIMIT} ms: it did not write ${marker}.`);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
