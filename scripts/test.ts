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
import CommentCheck from "./checks/comment-check.ts";
import CoverageExclusionCheck from "./checks/coverage-exclusion-check.ts";
import DeclaredDependencyCheck from "./checks/declared-dependency-check.ts";
import DependencyPinCheck from "./checks/dependency-pin-check.ts";
import DocumentCheck from "./checks/document-check.ts";
import FieldOrderCheck from "./checks/field-order-check.ts";
import FlakyRecord from "./checks/flaky-record.ts";
import type FlakyTest from "./checks/flaky-test.ts";
import GitHubConfigurationCheck from "./checks/github-configuration-check.ts";
import LicenseHeaderCheck from "./checks/license-header-check.ts";
import type ICheck from "./checks/interfaces/i-check.ts";
import type ISelectableCheck from "./checks/interfaces/i-selectable-check.ts";
import ModuleFolderCheck from "./checks/module-folder-check.ts";
import ModuleImportCheck from "./checks/module-import-check.ts";
import NameUniquenessCheck from "./checks/name-uniqueness-check.ts";
import PackageCheck from "./checks/package-check.ts";
import PackageLayoutCheck from "./checks/package-layout-check.ts";
import PackageTestCheck from "./checks/package-test-check.ts";
import PackagedBuildCheck from "./checks/packaged-build-check.ts";
import ProductIdentityCheck from "./checks/product-identity-check.ts";
import ScriptTestCheck from "./checks/script-test-check.ts";
import type SelectedTests from "./checks/selected-tests.ts";
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
import TestPart from "./test-part.ts";
import NpmCommand from "./toolchain/npm-command.ts";
import RunnerTotals from "./totals/runner-totals.ts";

export default class Test {
  private static readonly USAGE: string = "Usage: npm test [-- documents | [--filter <text>]... [--repeat <count>] [--rerun-failed] | [--part <part>] [--package <name>]... [--angular-tests] [--script-tests] [--repeat <count>] [--rerun-failed] | [--part <part>] --checks-only [--repeat <count>]]\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly SUMMARY_HEADER: string = "| Check | Result |\n|---|---|\n";
  private static readonly FILTERED_SUMMARY_HEADER: string = "| Check | Result | Unit | Discovered | Selected | Unselected |\n|---|---|---|---|---|---|\n";
  private static readonly DOCUMENTS_NOTICE: string = "Filtered run: documents. A filtered run is not the complete gate.\n";
  private static readonly NO_MATCH: string = "No test matched the filters.\n";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly API_TIMEOUT: number = 300_000;
  private static readonly API_PARTS: readonly string[] = ["src/shell/ui", "src/shell/window"];
  private static readonly RUNNERS: readonly string[] = [PackageTestCheck.RUNNER, ScriptTestCheck.RUNNER, AngularTestCheck.RUNNER];

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
      return await this.runChecksAsync(this.createDocumentChecks(), Test.DOCUMENTS_NOTICE, null);

    const flaky = options.isRerunningFailed ? new FlakyRecord(this.root, this.environment) : null;
    await flaky?.clearAsync();

    for (let run = 1; run <= options.repeat; run++) {
      if (options.repeat > 1)
        this.output.write(`\nRun ${run} of ${options.repeat}\n`);
      const exitCode = options.filters.length === 0
        ? await this.runChecksAsync(await this.createChecksAsync(options.part, flaky, options.selection), Test.formatNotice(options), flaky)
        : await this.runFilteredAsync(options.filters, flaky);
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

  private async runChecksAsync(checks: readonly ICheck[], notice: string | null, flaky: FlakyRecord | null): Promise<number> {
    if (notice !== null)
      this.output.write(notice);
    const earlier = (await flaky?.readAsync())?.length ?? 0;

    await RunnerTotals.clearAsync(this.root);
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

    const rerunPassed = Test.countByRunner((await flaky?.readAsync() ?? []).slice(earlier));
    const totals = (await RunnerTotals.readAllAsync(this.root, Test.RUNNERS)).map(t => t.withRerunPassed(rerunPassed.get(t.title) ?? 0));
    if (totals.length > 0) {
      for (const runner of totals)
        await runner.writeAsync(this.root);
      this.output.write(`\nTest totals\n${totals.map(t => t.formatLine()).join("")}`);
      summary += `\n${RunnerTotals.formatTable(totals)}`;
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

  private async runFilteredAsync(filters: readonly string[], flaky: FlakyRecord | null): Promise<number> {
    this.output.write(`Filtered run: ${filters.map(t => JSON.stringify(t)).join(", ")}. A filtered run is not the complete gate.\n`);
    const build = new PackageBuild(this.root, this.runner, this.environment, process.platform, process.arch);
    const angular = new AngularProject(this.root, this.runner, new NpmCommand(this.runner, this.environment));
    const checks: readonly ISelectableCheck[] = [
      new PackageTestCheck(this.root, build, this.runner, this.environment, flaky),
      new ScriptTestCheck(this.root, build, this.runner, this.environment, flaky),
      new AngularTestCheck(angular, flaky)
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

  private static formatNotice(options: TestOptions): string | null {
    const part = options.part === null ? "" : `Part run: ${options.part}. Only all ${TestPart.ALL.length} parts together are the complete gate.\n`;
    const selection = options.selection === undefined ? "" : `Selected run: every check other than the tests, and ${options.selection.description}. A selected run is not the complete gate.\n`;
    return part + selection === "" ? null : part + selection;
  }

  private static formatSummaryFilter(filter: string): string {
    return `<code>${filter.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;")}</code>`;
  }

  private static countByRunner(tests: readonly FlakyTest[]): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    for (const test of tests)
      counts.set(test.runner, (counts.get(test.runner) ?? 0) + 1);
    return counts;
  }

  private createDocumentChecks(): readonly ICheck[] {
    return [new DocumentCheck(this.root, new RepositoryFiles(this.root, new Git(this.root, this.runner)))];
  }

  private async createChecksAsync(part: string | null, flaky: FlakyRecord | null, selection?: SelectedTests): Promise<readonly ICheck[]> {
    const files = new RepositoryFiles(this.root, new Git(this.root, this.runner));
    const documents = new DocumentCheck(this.root, files);
    const { default: ApiCatalog } = await import("./api/api-catalog.ts");
    const { default: ApiServer } = await import("./api/api-server.ts");
    const { default: AngularFileCheck } = await import("./checks/angular-file-check.ts");
    const { default: ApiDeclarationCheck } = await import("./checks/api-declaration-check.ts");
    const { default: ApiDocumentationCheck } = await import("./checks/api-documentation-check.ts");
    const { default: ApiExampleCheck } = await import("./checks/api-example-check.ts");
    const { default: BucketNameCheck } = await import("./checks/bucket-name-check.ts");
    const { default: ConceptFileCheck } = await import("./checks/concept-file-check.ts");
    const { default: ConceptFolderCheck } = await import("./checks/concept-folder-check.ts");
    const { default: EnumValueCheck } = await import("./checks/enum-value-check.ts");
    const { default: ExceptionNameCheck } = await import("./checks/exception-name-check.ts");
    const { default: FoundationValueCheck } = await import("./checks/foundation-value-check.ts");
    const { default: InterfaceNameCheck } = await import("./checks/interface-name-check.ts");
    const { default: SyntaxTreeReader } = await import("./structure/syntax-tree.reader.ts");
    const tree = new SourceTree(this.root, files);
    const build = new PackageBuild(this.root, this.runner, this.environment, process.platform, process.arch);
    const modules = new ModuleCatalog(this.root);
    const angular = new AngularProject(this.root, this.runner, new NpmCommand(this.runner, this.environment));
    const apis = new ApiCatalog(this.root, new PackageCatalog(this.root), new BuildLayout(this.root), angular, Test.API_PARTS);
    const server = [ApiServer.locateCompiler()];
    const syntax = new SyntaxTreeReader(this.root, server, Test.API_TIMEOUT);
    const partOf = (check: ICheck): string => check instanceof PackageTestCheck ? TestPart.PACKAGES : check instanceof ScriptTestCheck ? TestPart.SCRIPTS : TestPart.ANGULAR_AND_CHECKS;
    const checks = [
      documents,
      new LicenseHeaderCheck(this.root, files),
      new CommentCheck(this.root, files),
      new TestWaitCheck(this.root, files),
      new FieldOrderCheck(this.root, files),
      new BucketNameCheck(files, syntax),
      new InterfaceNameCheck(files, syntax),
      new AngularFileCheck(files, syntax),
      new FoundationValueCheck(files, new PackageCatalog(this.root), syntax),
      new EnumValueCheck(files, syntax),
      new ExceptionNameCheck(files, syntax),
      new ConceptFileCheck(this.root, files, syntax),
      new ConceptFolderCheck(files, syntax),
      new GitHubConfigurationCheck(this.root, files),
      new ModuleFolderCheck(this.root, modules),
      new ShellIndependenceCheck(tree),
      new ProductIdentityCheck(tree, () => ProductIdentity.readAsync(this.root)),
      new ModuleImportCheck(tree, modules),
      new WindowImportCheck(tree, modules),
      new TestMirrorCheck(this.root, tree),
      new CoverageExclusionCheck(this.root, new PackageCatalog(this.root)),
      new NameUniquenessCheck(tree, modules),
      new DeclaredDependencyCheck(tree),
      new DependencyPinCheck(this.root, files),
      new PackageLayoutCheck(this.root, new PackageCatalog(this.root)),
      new PackageCheck(build),
      ...selection === undefined || selection.packages.length > 0 ? [new PackageTestCheck(this.root, build, this.runner, this.environment, flaky, selection?.packages)] : [],
      new TypeCheck(this.root, this.runner),
      new ApiDeclarationCheck(this.root, apis, server, Test.API_TIMEOUT),
      new ApiDocumentationCheck(this.root, apis, server, Test.API_TIMEOUT),
      new ApiExampleCheck(this.root, apis, this.runner, server, Test.API_TIMEOUT),
      ...selection === undefined || selection.runsScriptTests ? [new ScriptTestCheck(this.root, build, this.runner, this.environment, flaky)] : [],
      ...selection === undefined || selection.runsAngularTests ? [new AngularTestCheck(angular, flaky)] : [],
      new PackagedBuildCheck(this.root, new PackagedBuild(this.root, this.runner, new GalleryFile(this.root), angular), angular)
    ];
    return checks.filter(t => part === null || partOf(t) === part);
  }
}

if (import.meta.main)
  process.exitCode = await new Test(process.cwd(), new ProcessRunner(), process.stdout, process.env).runAsync(process.argv.slice(2));
