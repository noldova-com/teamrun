/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import DevelopmentBinary from "./desktop/development-binary.ts";
import BuildRecord from "./packages/build-record.ts";
import ContentHash from "./packages/content-hash.ts";
import ProcessRunner from "./processes/process-runner.ts";
import Git from "./repository/git.ts";
import RepositoryFiles from "./repository/repository-files.ts";

export default class UiWorkflows {
  private static readonly BUILD_SCRIPT: readonly string[] = ["scripts", "build.ts"];
  private static readonly TYPESCRIPT_CLI: readonly string[] = ["node_modules", "typescript", "bin", "tsc"];
  private static readonly PLAYWRIGHT_CLI: readonly string[] = ["node_modules", "playwright", "cli.js"];
  private static readonly E2E_PROJECT: string = "src/shell/desktop/tests/e2e";
  private static readonly PLAYWRIGHT_CONFIG: string = "src/shell/desktop/tests/e2e/playwright.config.ts";
  private static readonly RECORD_SEGMENTS: readonly string[] = ["_build", "ui-builds.record"];
  private static readonly DECLARATIONS_SEGMENTS: readonly string[] = ["_build", "modules", "declarations.json"];
  private static readonly TREE_OUTPUTS: readonly (readonly string[])[] = [
    ["_build", "window"],
    ["_build", "variants", "no-modules"],
    ["_build", "variants", "without-clock"]
  ];
  private static readonly BUILDS: readonly (readonly string[])[] = [
    ["--test", "--without", "notes", "--without", "clock", "--output", "_build/variants/no-modules"],
    ["--test", "--without", "clock", "--output", "_build/variants/without-clock"],
    ["--test"]
  ];
  private static readonly CURRENT: string = "The builds of the UI workflows are current.\n";
  private static readonly REQUIRE_CURRENT: string = "--require-current";
  private static readonly NOT_CURRENT: string = "The builds of the UI workflows are not current, and --require-current forbids building them here, so nothing ran.\n";
  private static readonly BUILDING: string = "Building the test build and its variants for the UI workflows...\n";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly files: RepositoryFiles;
  private readonly output: Writable;
  private readonly binary: DevelopmentBinary;

  public constructor(root: string, runner: ProcessRunner, output: Writable, binary: DevelopmentBinary) {
    this.root = root;
    this.runner = runner;
    this.files = new RepositoryFiles(root, new Git(root, runner));
    this.output = output;
    this.binary = binary;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const requiresCurrent = commandArguments.includes(UiWorkflows.REQUIRE_CURRENT);
    const playwrightArguments = commandArguments.filter(t => t !== UiWorkflows.REQUIRE_CURRENT);
    const inputs = await this.hashInputsAsync();
    const recordFile = path.join(this.root, ...UiWorkflows.RECORD_SEGMENTS);
    if (await this.isCurrentAsync(inputs, recordFile))
      this.output.write(UiWorkflows.CURRENT);
    else if (requiresCurrent) {
      this.output.write(UiWorkflows.NOT_CURRENT);
      return 1;
    }
    else {
      this.output.write(UiWorkflows.BUILDING);
      for (const buildArguments of UiWorkflows.BUILDS) {
        const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...UiWorkflows.BUILD_SCRIPT), ...buildArguments], this.root);
        if (exitCode !== 0)
          return exitCode ?? 1;
      }
      await (await this.hashOutputsAsync(inputs)).writeAsync(recordFile);
    }
    await this.binary.prepareAsync(this.output);

    const typeScript = await this.runner.runAsync(process.execPath, [path.join(this.root, ...UiWorkflows.TYPESCRIPT_CLI), "--project", UiWorkflows.E2E_PROJECT], this.root);
    if (typeScript !== 0)
      return typeScript ?? 1;
    return await this.runner.runAsync(process.execPath, [path.join(this.root, ...UiWorkflows.PLAYWRIGHT_CLI), "test", "--config", UiWorkflows.PLAYWRIGHT_CONFIG, ...playwrightArguments], this.root) ?? 1;
  }

  private async isCurrentAsync(inputs: string, recordFile: string): Promise<boolean> {
    return this.listOutputs().every(t => existsSync(t)) && await (await this.hashOutputsAsync(inputs)).isRecordedAsync(recordFile);
  }

  private async hashInputsAsync(): Promise<string> {
    const parts: string[] = [JSON.stringify(UiWorkflows.BUILDS)];
    for (const file of await this.files.listAsync())
      parts.push(file, await ContentHash.ofFileAsync(path.join(this.root, file)));
    return ContentHash.ofParts(parts);
  }

  private async hashOutputsAsync(inputs: string): Promise<BuildRecord> {
    const outputs = [await ContentHash.ofFileAsync(path.join(this.root, ...UiWorkflows.DECLARATIONS_SEGMENTS))];
    for (const tree of UiWorkflows.TREE_OUTPUTS)
      outputs.push(await ContentHash.ofTreeAsync(path.join(this.root, ...tree)));
    return new BuildRecord(inputs, outputs);
  }

  private listOutputs(): readonly string[] {
    return [path.join(this.root, ...UiWorkflows.DECLARATIONS_SEGMENTS), ...UiWorkflows.TREE_OUTPUTS.map(t => path.join(this.root, ...t))];
  }
}

if (import.meta.main) {
  const root = realpathSync(process.cwd());
  const runner = new ProcessRunner();
  process.exitCode = await new UiWorkflows(root, runner, process.stdout, new DevelopmentBinary(root, runner)).runAsync(process.argv.slice(2));
}
