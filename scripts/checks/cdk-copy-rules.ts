/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";

import { ProcessException } from "../processes/process.exception.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { TemporaryFolder } from "../processes/temporary-folder.ts";
import { NpmCommand } from "../toolchain/npm-command.ts";
import { CdkCopyCheck } from "./cdk-copy-check.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class CdkCopyRules implements ICheck {
  private static readonly PREFIX: string = "teamrun-cdk-";
  private static readonly CDK: string = "node_modules/@angular/cdk";
  private static readonly KIT: string = "node_modules/kit";
  private static readonly NESTED_CDK: string = "node_modules/kit/node_modules/@angular/cdk";
  private static readonly PROJECT_CDK: string = "src/node_modules/@angular/cdk";
  private static readonly PROJECT: string = "src";
  private static readonly PROJECT_LINK: string = "node_modules/app";
  private static readonly PACKAGE_SEPARATOR: string = "node_modules/";
  private static readonly LIST: string = "\"npm ls @angular/cdk --all --json --long --workspace src\"";
  private static readonly ROOT: string = JSON.stringify({ name: "root", version: "1.0.0", workspaces: ["src"] });
  private static readonly TWO_COPIES: string = "The src/ workspace's install holds 2 copies of @angular/cdk, so the UI kit's overlays and focus handling and the app's would run from different ones:\n";
  private static readonly ONE_VERSION: string = "Install the version the UI kit pins, so npm keeps one copy.\n";
  private static readonly APP: string = JSON.stringify({ name: "app", version: "1.0.0", dependencies: { "@angular/cdk": "1.0.0", kit: "1.0.0" } });
  private static readonly RULES: readonly {
    readonly name: string;
    readonly manifest: string;
    readonly npm: string | null;
    readonly packages: readonly (readonly [string, string, Record<string, string>])[];
    readonly passes: boolean;
    readonly output: string;
  }[] = [
    {
      name: "one copy the app and the kit share",
      manifest: CdkCopyRules.ROOT,
      npm: null,
      packages: [[CdkCopyRules.CDK, "1.0.0", {}], [CdkCopyRules.KIT, "1.0.0", { "@angular/cdk": "1.0.0" }]],
      passes: true,
      output: "Found one copy of @angular/cdk in the src/ workspace's install.\n"
    },
    {
      name: "a copy of another version under the kit",
      manifest: CdkCopyRules.ROOT,
      npm: null,
      packages: [[CdkCopyRules.CDK, "1.0.1", {}], [CdkCopyRules.KIT, "1.0.0", { "@angular/cdk": "1.0.0" }], [CdkCopyRules.NESTED_CDK, "1.0.0", {}]],
      passes: false,
      output: `${CdkCopyRules.TWO_COPIES}  1.0.1 at node_modules/@angular/cdk\n  1.0.0 at node_modules/kit/node_modules/@angular/cdk\n${CdkCopyRules.ONE_VERSION}`
    },
    {
      name: "a second copy of the same version under the kit",
      manifest: CdkCopyRules.ROOT,
      npm: null,
      packages: [[CdkCopyRules.CDK, "1.0.0", {}], [CdkCopyRules.KIT, "1.0.0", { "@angular/cdk": "1.0.0" }], [CdkCopyRules.NESTED_CDK, "1.0.0", {}]],
      passes: false,
      output: `${CdkCopyRules.TWO_COPIES}  1.0.0 at node_modules/@angular/cdk\n  1.0.0 at node_modules/kit/node_modules/@angular/cdk\n${CdkCopyRules.ONE_VERSION}`
    },
    {
      name: "a copy of its own under the Angular project beside the kit's at the root",
      manifest: CdkCopyRules.ROOT,
      npm: null,
      packages: [[CdkCopyRules.CDK, "1.0.0", {}], [CdkCopyRules.KIT, "1.0.0", { "@angular/cdk": "1.0.0" }], [CdkCopyRules.PROJECT_CDK, "1.0.0", {}]],
      passes: false,
      output: `${CdkCopyRules.TWO_COPIES}  1.0.0 at node_modules/@angular/cdk\n  1.0.0 at src/node_modules/@angular/cdk\n${CdkCopyRules.ONE_VERSION}`
    },
    {
      name: "no copy, which the app and the kit still ask for",
      manifest: CdkCopyRules.ROOT,
      npm: null,
      packages: [[CdkCopyRules.KIT, "1.0.0", { "@angular/cdk": "1.0.0" }]],
      passes: false,
      output: "npm ls found no @angular/cdk in the src/ workspace's install, so the check read nothing.\n"
    },
    {
      name: "a root package.json npm can't read",
      manifest: "{ not json",
      npm: null,
      packages: [],
      passes: false,
      output: `${CdkCopyRules.LIST} failed (EJSONPARSE): Invalid package.json: JSONParseError: Expected property name or '}' in JSON at position 2 (line 1 column 3) while parsing "{ not json"\n`
    },
    {
      name: "an npm that prints no list",
      manifest: CdkCopyRules.ROOT,
      npm: "console.log('not a list');",
      packages: [],
      passes: false,
      output: `${CdkCopyRules.LIST} gave no list to read: not a list\n`
    }
  ];

  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public readonly title: string = "Angular cdk copy rules";

  public constructor(runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.environment = environment;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const folders = new TemporaryFolder();
    let failures = 0;
    for (const rule of CdkCopyRules.RULES) {
      const work = await folders.createAsync(process.platform, CdkCopyRules.PREFIX);
      try {
        await CdkCopyRules.installAsync(work, rule.manifest, rule.packages);
        const script = path.join(work, "npm.js");
        if (rule.npm !== null)
          await writeFile(script, rule.npm);
        const environment = rule.npm === null ? this.environment : { ...this.environment, npm_execpath: script };
        let written = "";
        const collected = new Writable({
          write: (chunk, _encoding, done) => {
            written += String(chunk);
            done();
          }
        });
        let passed = false;
        try {
          passed = await new CdkCopyCheck(work, new NpmCommand(this.runner, environment)).runAsync(collected);
        }
        catch (error) {
          if (!(error instanceof ProcessException))
            throw error;
          written += `${error.message}\n`;
        }
        if (passed !== rule.passes || written !== rule.output) {
          failures++;
          output.write(`The rule for ${rule.name} expected ${rule.passes ? "a pass" : "a failure"} saying:\n${rule.output}but got ${passed ? "a pass" : "a failure"} saying:\n${written}`);
        }
      }
      finally {
        await folders.removeAsync(work);
      }
    }
    output.write(failures === 0 ? `The ${CdkCopyRules.RULES.length} copy rules hold.\n` : `${failures} of the ${CdkCopyRules.RULES.length} copy rules failed.\n`);
    return failures === 0;
  }

  private static async installAsync(work: string, manifest: string, packages: readonly (readonly [string, string, Record<string, string>])[]): Promise<void> {
    const project = path.join(work, CdkCopyRules.PROJECT);
    await mkdir(project, { recursive: true });
    await writeFile(path.join(work, "package.json"), manifest);
    await writeFile(path.join(project, "package.json"), CdkCopyRules.APP);
    const link = path.join(work, ...CdkCopyRules.PROJECT_LINK.split("/"));
    await mkdir(path.dirname(link), { recursive: true });
    await symlink(project, link, "junction");
    for (const [folder, version, dependencies] of packages) {
      const file = path.join(work, ...folder.split("/"), "package.json");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ name: folder.split(CdkCopyRules.PACKAGE_SEPARATOR).pop(), version, dependencies }));
    }
  }
}
