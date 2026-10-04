/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BuildIdentity } from "@noldova/teamrun-shell-protocol";
import { RuntimeBuild, RuntimeEntry } from "@noldova/teamrun-shell-runtime";

export class ProbeBuildFixture implements AsyncDisposable {
  public static readonly WAITING_MARKER: string = "waiting";
  private static readonly PROBE_PART: string = [
    "import { writeFile } from \"node:fs/promises\";",
    "import path from \"node:path\";",
    "import { RuntimeCommand } from \"@noldova/teamrun-shell-runtime\";",
    "export class RuntimePart {",
    "  migrations = [];",
    "  async activateAsync(context) {",
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
    const resources = path.join(copy, "resources.js");
    const text = (await readFile(resources, "utf8"))
      .replace(`productVersion = "${RuntimeBuild.identity.productVersion}"`, `productVersion = "${identity.productVersion}"`)
      .replace(`build = "${RuntimeBuild.identity.fingerprint}"`, `build = "${identity.fingerprint}"`);
    await writeFile(resources, text);
    const probe = path.join(folder, "probe.mjs");
    await writeFile(probe, ProbeBuildFixture.PROBE_PART);
    const modules = path.join(folder, "_build", "modules");
    await mkdir(modules, { recursive: true });
    const declaration = { id: "probe", version: "0.0.1", displayName: "Probe", description: "Answers the command line tests.", dependencies: [], runtimePackage: pathToFileURL(probe).href, contributes: { commands: ["probe.echo", "probe.fail", "probe.wait"] } };
    const declarationsFile = path.join(modules, "declarations.json");
    await writeFile(declarationsFile, JSON.stringify({ formatVersion: 1, modules: [declaration] }));
    return new ProbeBuildFixture(folder, identity, path.join(copy, "services", "runtime-entry.js"), declarationsFile);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
}
