/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { ProcessException } from "../processes/process.exception.ts";
import type { NpmCommand } from "../toolchain/npm-command.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class CdkCopyCheck implements ICheck {
  private static readonly PACKAGE: string = "@angular/cdk";
  private static readonly FOLDER: string = "src";
  private static readonly ARGUMENTS: readonly string[] = ["ls", CdkCopyCheck.PACKAGE, "--all", "--json", "--long", "--workspace", CdkCopyCheck.FOLDER];
  private static readonly DEPENDENCIES: string = "dependencies";
  private static readonly VERSION: string = "version";
  private static readonly PATH: string = "path";
  private static readonly ERROR: string = "error";
  private static readonly CODE: string = "code";
  private static readonly SUMMARY: string = "summary";
  private static readonly PROBLEMS_CODE: string = "ELSPROBLEMS";

  private readonly root: string;
  private readonly npm: NpmCommand;

  public readonly title: string = "Angular cdk copies";

  public constructor(root: string, npm: NpmCommand) {
    this.root = root;
    this.npm = npm;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const result = await this.npm.runAsync(CdkCopyCheck.ARGUMENTS, this.root);
    let tree: unknown;
    try {
      tree = JSON.parse(result.output);
    }
    catch (error) {
      throw new ProcessException(`"npm ${CdkCopyCheck.ARGUMENTS.join(" ")}" gave no list to read: ${result.text}`, { cause: error });
    }
    const failure = CdkCopyCheck.field(tree, CdkCopyCheck.ERROR);
    const code = CdkCopyCheck.field(failure, CdkCopyCheck.CODE);
    if (!Object.isUndefined(failure) && code !== CdkCopyCheck.PROBLEMS_CODE)
      throw new ProcessException(`"npm ${CdkCopyCheck.ARGUMENTS.join(" ")}" failed (${String(code)}): ${String(CdkCopyCheck.field(failure, CdkCopyCheck.SUMMARY))}`);
    const copies = new Map<string, string>();
    CdkCopyCheck.collect(tree, copies);
    if (copies.size === 0) {
      output.write(`npm ls found no ${CdkCopyCheck.PACKAGE} in the ${CdkCopyCheck.FOLDER}/ workspace's install, so the check read nothing.\n`);
      return false;
    }
    if (copies.size === 1) {
      output.write(`Found one copy of ${CdkCopyCheck.PACKAGE} in the ${CdkCopyCheck.FOLDER}/ workspace's install.\n`);
      return true;
    }
    output.write(`The ${CdkCopyCheck.FOLDER}/ workspace's install holds ${copies.size} copies of ${CdkCopyCheck.PACKAGE}, so the UI kit's overlays and focus handling and the app's would run from different ones:\n`);
    for (const [folder, version] of [...copies].sort(([left], [right]) => left.localeCompare(right)))
      output.write(`  ${version} at ${path.relative(this.root, folder).replaceAll("\\", "/")}\n`);
    output.write("Install the version the UI kit pins, so npm keeps one copy.\n");
    return false;
  }

  private static collect(node: unknown, copies: Map<string, string>): void {
    const dependencies = CdkCopyCheck.field(node, CdkCopyCheck.DEPENDENCIES);
    if (!Object.isObject(dependencies))
      return;
    for (const [name, child] of Object.entries(dependencies)) {
      const folder = CdkCopyCheck.field(child, CdkCopyCheck.PATH);
      if (name === CdkCopyCheck.PACKAGE && Object.isString(folder))
        copies.set(folder, String(CdkCopyCheck.field(child, CdkCopyCheck.VERSION)));
      CdkCopyCheck.collect(child, copies);
    }
  }

  private static field(value: unknown, name: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
  }
}
