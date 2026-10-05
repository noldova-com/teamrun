/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import AngularProject from "./angular/angular-project.ts";
import GalleryFile from "./angular/gallery-file.ts";
import AngularTestCheck from "./checks/angular-test-check.ts";
import DeclaredDependencyCheck from "./checks/declared-dependency-check.ts";
import DocumentCheck from "./checks/document-check.ts";
import GitHubConfigurationCheck from "./checks/github-configuration-check.ts";
import LicenseHeaderCheck from "./checks/license-header-check.ts";
import type ICheck from "./checks/interfaces/check.ts";
import type ISelectableCheck from "./checks/interfaces/selectable-check.ts";
import ModuleFolderCheck from "./checks/module-folder-check.ts";
import ModuleImportCheck from "./checks/module-import-check.ts";
import NameUniquenessCheck from "./checks/name-uniqueness-check.ts";
import PackageCheck from "./checks/package-check.ts";
import PackageTestCheck from "./checks/package-test-check.ts";
import PackagedBuildCheck from "./checks/packaged-build-check.ts";
import ProductIdentityCheck from "./checks/product-identity-check.ts";
import ScriptTestCheck from "./checks/script-test-check.ts";
import ShellIndependenceCheck from "./checks/shell-independence-check.ts";
import TestMirrorCheck from "./checks/test-mirror-check.ts";
import TestWaitCheck from "./checks/test-wait-check.ts";
import TypeCheck from "./checks/type-check.ts";
import WindowImportCheck from "./checks/window-import-check.ts";
import BuildLayout from "./packages/build-layout.ts";
import PackageBuild from "./packages/package-build.ts";
import ModuleCatalog from "./modules/module-catalog.ts";
import PackageCatalog from "./packages/package-catalog.ts";
import ProductIdentity from "./packages/product-identity.ts";
import PackagedBuild from "./packaging/packaged-build.ts";
import ProcessRunner from "./processes/process-runner.ts";
import Git from "./repository/git.ts";
import RepositoryFiles from "./repository/repository-files.ts";
import SourceTree from "./structure/source-tree.ts";
import TestOptions from "./test-options.ts";
import TestOptionsException from "./test-options.exception.ts";
import NpmCommand from "./toolchain/npm-command.ts";

export default class Test {
  private static readonly USAGE: string = "Usage: npm test [-- documents | [--filter <text>]... [--repeat <count>]]\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly SUMMARY_HEADER: string = "| Check | Result |\n|---|---|\n";
  private static readonly FILTERED_SUMMARY_HEADER: string = "| Check | Result | Unit | Discovered | Selected | Unselected |\n|---|---|---|---|---|---|\n";
  private static readonly NO_MATCH: string = "No test matched the filters.\n";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly API_TIMEOUT: number = 300_000;
  private static readonly API_PARTS: readonly string[] = ["src/shell/ui", "src/shell/window"];

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
    let options: TestOptions;
    try {
      options = TestOptions.parse(selection);
    }
    catch (error) {
      if (!(error instanceof TestOptionsException))
        throw error;
      this.output.write(`${error.message}\n${Test.USAGE}`);
      return Test.USAGE_EXIT_CODE;
    }
    if (options.isDocuments)
      return await this.runChecksAsync(this.createDocumentChecks(), "documents");

    for (let run = 1; run <= options.repeat; run++) {
      if (options.repeat > 1)
        this.output.write(`\nRun ${run} of ${options.repeat}\n`);
      const exitCode = options.filters.length === 0
        ? await this.runChecksAsync(await this.createChecksAsync(), null)
        : await this.runFilteredAsync(options.filters);
      if (exitCode !== 0) {
        if (options.repeat > 1)
          this.output.write(`\nRun ${run} of ${options.repeat} failed; the repeats stop there.\n`);
        return exitCode;
      }
    }
    if (options.repeat > 1)
      this.output.write(`\nAll ${options.repeat} runs passed.\n`);
    return 0;
  }

  private async runChecksAsync(checks: readonly ICheck[], label: string | null): Promise<number> {
    if (label !== null)
      this.output.write(`Filtered run: ${label}. A filtered run is not the complete gate.\n`);

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
    await this.writeSummaryAsync(summary);
    return failures === 0 ? 0 : 1;
  }

  private async writeSummaryAsync(summary: string): Promise<void> {
    const summaryPath = this.environment[Test.SUMMARY_VARIABLE];
    if (summaryPath !== undefined)
      await appendFile(summaryPath, summary);
  }

  private async runFilteredAsync(filters: readonly string[]): Promise<number> {
    this.output.write(`Filtered run: ${filters.map(t => JSON.stringify(t)).join(", ")}. A filtered run is not the complete gate.\n`);
    const build = new PackageBuild(this.root, this.runner, this.environment);
    const angular = new AngularProject(this.root, this.runner, new NpmCommand(this.runner, this.environment));
    const checks: readonly ISelectableCheck[] = [
      new PackageTestCheck(this.root, build, this.runner, this.environment),
      new ScriptTestCheck(this.root, build, this.runner, this.environment),
      new AngularTestCheck(angular)
    ];

    let summary = `Filters: ${filters.map(t => Test.formatSummaryFilter(t)).join(" ")}\n\n${Test.FILTERED_SUMMARY_HEADER}`;
    let failures = 0;
    let selected = 0;
    for (const check of checks) {
      this.output.write(`\n${check.title}\n`);
      const selection = await check.runSelectedAsync(filters, this.output);
      const result = !selection.isPassing ? "Failed" : selection.selected === 0 ? "None selected" : "Passed";
      this.output.write(`${check.title}: ${result.toLowerCase()}; ${selection.selected} of ${selection.discovered} ${selection.unit} selected, ${selection.unselected} not selected.\n`);
      summary += `| ${check.title} | ${result} | ${selection.unit} | ${selection.discovered} | ${selection.selected} | ${selection.unselected} |\n`;
      selected += selection.selected;
      if (!selection.isPassing)
        failures++;
    }
    if (selected === 0) {
      this.output.write(Test.NO_MATCH);
      summary += `\n${Test.NO_MATCH}`;
      failures++;
    }

    this.output.write(`\n${checks.length - failures} of ${checks.length} checks passed.\n`);
    await this.writeSummaryAsync(summary);
    return failures === 0 ? 0 : 1;
  }

  private static formatSummaryFilter(filter: string): string {
    return `<code>${filter.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;")}</code>`;
  }

  private createDocumentChecks(): readonly ICheck[] {
    return [new DocumentCheck(this.root, new RepositoryFiles(this.root, new Git(this.root, this.runner)))];
  }

  private async createChecksAsync(): Promise<readonly ICheck[]> {
    const files = new RepositoryFiles(this.root, new Git(this.root, this.runner));
    const documents = new DocumentCheck(this.root, files);
    const { default: ApiCatalog } = await import("./api/api-catalog.ts");
    const { default: ApiServer } = await import("./api/api-server.ts");
    const { default: ApiDeclarationCheck } = await import("./checks/api-declaration-check.ts");
    const { default: ApiExampleCheck } = await import("./checks/api-example-check.ts");
    const tree = new SourceTree(this.root, files);
    const build = new PackageBuild(this.root, this.runner, this.environment);
    const modules = new ModuleCatalog(this.root);
    const angular = new AngularProject(this.root, this.runner, new NpmCommand(this.runner, this.environment));
    const apis = new ApiCatalog(this.root, new PackageCatalog(this.root), new BuildLayout(this.root), angular, Test.API_PARTS);
    const server = [ApiServer.locateCompiler()];
    return [
      documents,
      new LicenseHeaderCheck(this.root, files),
      new TestWaitCheck(this.root, files),
      new GitHubConfigurationCheck(this.root, files),
      new ModuleFolderCheck(this.root, modules),
      new ShellIndependenceCheck(tree),
      new ProductIdentityCheck(tree, () => ProductIdentity.readAsync(this.root)),
      new ModuleImportCheck(tree, modules),
      new WindowImportCheck(tree),
      new TestMirrorCheck(this.root, tree),
      new NameUniquenessCheck(tree, modules),
      new DeclaredDependencyCheck(tree),
      new PackageCheck(build),
      new PackageTestCheck(this.root, build, this.runner, this.environment),
      new TypeCheck(this.root, this.runner),
      new ApiDeclarationCheck(this.root, apis, server, Test.API_TIMEOUT),
      new ApiExampleCheck(this.root, apis, this.runner, server, Test.API_TIMEOUT),
      new ScriptTestCheck(this.root, build, this.runner, this.environment),
      new AngularTestCheck(angular),
      new PackagedBuildCheck(this.root, new PackagedBuild(this.root, this.runner, new GalleryFile(this.root), angular), angular)
    ];
  }
}

if (import.meta.main)
  process.exitCode = await new Test(process.cwd(), new ProcessRunner(), process.stdout, process.env).runAsync(process.argv.slice(2));
