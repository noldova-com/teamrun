/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { ProcessRunner } from "../../../scripts/processes/process-runner.ts";
import { BuildDocs } from "./build-docs.ts";
import { DocsSiteCheck } from "./docs-site-check.ts";

export class TestDocs {
  private static readonly ANGULAR_CLI: string = "node_modules/@angular/cli/bin/ng.js";
  private static readonly TEST_ARGUMENTS: readonly string[] = ["test", "docs", "--reporters=default"];
  private static readonly COVERAGE_FOLDER: string = "_build/docs-coverage";
  private static readonly DEPENDENCY_CACHE: string = "node_modules/.vite";
  private static readonly SITE_FOLDER: string = "src/noldova.teamrun.docs";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;

  public constructor(root: string, runner: ProcessRunner, output: Writable) {
    this.root = root;
    this.runner = runner;
    this.output = output;
  }

  public async runAsync(): Promise<number> {
    if (await new BuildDocs(this.root, this.runner, this.output).runAsync() !== 0)
      return 1;
    await rm(path.join(this.root, TestDocs.COVERAGE_FOLDER), { recursive: true, force: true });
    await rm(path.join(this.root, TestDocs.DEPENDENCY_CACHE), { recursive: true, force: true });
    const tested = await this.runner.runAsync(process.execPath, [path.join(this.root, TestDocs.ANGULAR_CLI), ...TestDocs.TEST_ARGUMENTS], path.join(this.root, TestDocs.SITE_FOLDER));
    const site = new DocsSiteCheck(this.root);
    this.output.write(`\n${site.title}\n`);
    const isSiteSound = await site.runAsync(this.output);
    return tested === 0 && isSiteSound ? 0 : 1;
  }
}

if (import.meta.main)
  process.exitCode = await new TestDocs(path.resolve(import.meta.dirname, "../../.."), new ProcessRunner(), process.stdout).runAsync();
