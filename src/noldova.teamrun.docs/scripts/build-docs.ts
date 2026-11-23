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
import { ProcessException } from "../../../scripts/processes/process.exception.ts";
import { DocsPreparation } from "./docs/docs-preparation.ts";

export class BuildDocs {
  private static readonly ANGULAR_CLI: string = "node_modules/@angular/cli/bin/ng.js";
  private static readonly BUILD_ARGUMENTS: readonly string[] = ["build", "docs"];
  private static readonly OUTPUT_FOLDER: string = "_build/docs";
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
    try {
      await new DocsPreparation(this.root).prepareAsync(this.output);
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
    await rm(path.join(this.root, BuildDocs.OUTPUT_FOLDER), { recursive: true, force: true });
    return await this.runner.runAsync(process.execPath, [path.join(this.root, BuildDocs.ANGULAR_CLI), ...BuildDocs.BUILD_ARGUMENTS], path.join(this.root, BuildDocs.SITE_FOLDER)) ?? 1;
  }
}

if (import.meta.main)
  process.exitCode = await new BuildDocs(path.resolve(import.meta.dirname, "../../.."), new ProcessRunner(), process.stdout).runAsync();
