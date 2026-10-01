/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import DocumentCheck from "./checks/document-check.ts";
import type ICheck from "./checks/interfaces/check.ts";
import ModuleFolderCheck from "./checks/module-folder-check.ts";
import PackageCheck from "./checks/package-check.ts";
import ScriptTestCheck from "./checks/script-test-check.ts";
import TypeCheck from "./checks/type-check.ts";
import PackageCatalog from "./packages/package-catalog.ts";
import ProcessRunner from "./processes/process-runner.ts";
import Git from "./repository/git.ts";
import RepositoryFiles from "./repository/repository-files.ts";

export default class Test {
  private static readonly DOCUMENTS_SELECTION: string = "documents";
  private static readonly USAGE: string = "Usage: npm test [-- documents]\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly SUMMARY_HEADER: string = "| Check | Result |\n|---|---|\n";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, output: Writable, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.runner = runner;
    this.output = output;
    this.environment = environment;
  }

  public async runAsync(selection: readonly string[]): Promise<number> {
    const checks = this.selectChecks(selection);
    if (checks === null) {
      this.output.write(Test.USAGE);
      return Test.USAGE_EXIT_CODE;
    }
    if (selection.length > 0)
      this.output.write(`Filtered run: ${selection.join(" ")}. A filtered run is not the complete gate.\n`);

    let summary = Test.SUMMARY_HEADER;
    let failures = 0;
    for (const check of checks) {
      this.output.write(`\n${check.title}\n`);
      const passed = await check.runAsync(this.output);
      this.output.write(`${check.title}: ${passed ? "passed" : "failed"}\n`);
      summary += `| ${check.title} | ${passed ? "Passed" : "Failed"} |\n`;
      if (!passed)
        failures++;
    }

    this.output.write(`\n${checks.length - failures} of ${checks.length} checks passed.\n`);
    const summaryPath = this.environment[Test.SUMMARY_VARIABLE];
    if (summaryPath !== undefined)
      await appendFile(summaryPath, summary);
    return failures === 0 ? 0 : 1;
  }

  private selectChecks(selection: readonly string[]): readonly ICheck[] | null {
    const documents = new DocumentCheck(this.root, new RepositoryFiles(this.root, new Git(this.root, this.runner)));
    if (selection.length === 0)
      return [
        documents,
        new ModuleFolderCheck(this.root),
        new PackageCheck(new PackageCatalog(this.root)),
        new TypeCheck(this.root, this.runner),
        new ScriptTestCheck(this.root, this.runner)
      ];
    return selection.length === 1 && selection[0] === Test.DOCUMENTS_SELECTION ? [documents] : null;
  }
}

if (import.meta.main)
  process.exitCode = await new Test(process.cwd(), new ProcessRunner(), process.stdout, process.env).runAsync(process.argv.slice(2));
