/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import AngularProject from "../angular/angular-project.ts";
import GalleryFile from "../angular/gallery-file.ts";
import ModuleCatalog from "../modules/module-catalog.ts";
import BuildLayout from "../packages/build-layout.ts";
import PackageBuild from "../packages/package-build.ts";
import PackageCatalog from "../packages/package-catalog.ts";
import ProductIdentity from "../packages/product-identity.ts";
import PackagedBuild from "../packaging/packaged-build.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import Git from "../repository/git.ts";
import RepositoryFiles from "../repository/repository-files.ts";
import SourceTree from "../structure/source-tree.ts";
import TestPart from "../test-part.ts";
import NpmCommand from "../toolchain/npm-command.ts";
import AngularTestCheck from "./angular-test-check.ts";
import CommentCheck from "./comment-check.ts";
import CoverageExclusionCheck from "./coverage-exclusion-check.ts";
import DeclaredDependencyCheck from "./declared-dependency-check.ts";
import DependencyPinCheck from "./dependency-pin-check.ts";
import DocumentCheck from "./document-check.ts";
import FieldOrderCheck from "./field-order-check.ts";
import type FlakyRecord from "./flaky-record.ts";
import GateCheck from "./gate-check.ts";
import GitHubConfigurationCheck from "./github-configuration-check.ts";
import type ICheck from "./interfaces/i-check.ts";
import type IGateChecks from "./interfaces/i-gate-checks.ts";
import LicenseHeaderCheck from "./license-header-check.ts";
import ModuleFolderCheck from "./module-folder-check.ts";
import ModuleImportCheck from "./module-import-check.ts";
import NameUniquenessCheck from "./name-uniqueness-check.ts";
import PackageCheck from "./package-check.ts";
import PackageLayoutCheck from "./package-layout-check.ts";
import PackageTestCheck from "./package-test-check.ts";
import PackagedBuildCheck from "./packaged-build-check.ts";
import ProductIdentityCheck from "./product-identity-check.ts";
import ScriptTestCheck from "./script-test-check.ts";
import ShellIndependenceCheck from "./shell-independence-check.ts";
import TestMirrorCheck from "./test-mirror-check.ts";
import TestWaitCheck from "./test-wait-check.ts";
import TypeCheck from "./type-check.ts";
import WindowImportCheck from "./window-import-check.ts";

export default class GateChecks implements IGateChecks {
  private static readonly API_TIMEOUT: number = 300_000;
  private static readonly API_PARTS: readonly string[] = ["src/shell/ui", "src/shell/window"];

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
  }

  public createDocumentChecks(): readonly ICheck[] {
    return [new DocumentCheck(this.root, new RepositoryFiles(this.root, new Git(this.root, this.runner)))];
  }

  public async createAsync(flaky: FlakyRecord | null, packages?: readonly string[]): Promise<readonly GateCheck[]> {
    const files = new RepositoryFiles(this.root, new Git(this.root, this.runner));
    const { default: ApiCatalog } = await import("../api/api-catalog.ts");
    const { default: ApiServer } = await import("../api/api-server.ts");
    const { default: AngularFileCheck } = await import("./angular-file-check.ts");
    const { default: ApiDeclarationCheck } = await import("./api-declaration-check.ts");
    const { default: ApiDocumentationCheck } = await import("./api-documentation-check.ts");
    const { default: ApiExampleCheck } = await import("./api-example-check.ts");
    const { default: BucketNameCheck } = await import("./bucket-name-check.ts");
    const { default: ConceptFileCheck } = await import("./concept-file-check.ts");
    const { default: ConceptFolderCheck } = await import("./concept-folder-check.ts");
    const { default: EnumValueCheck } = await import("./enum-value-check.ts");
    const { default: ExceptionNameCheck } = await import("./exception-name-check.ts");
    const { default: FoundationValueCheck } = await import("./foundation-value-check.ts");
    const { default: InterfaceNameCheck } = await import("./interface-name-check.ts");
    const { default: SyntaxTreeReader } = await import("../structure/syntax-tree.reader.ts");
    const tree = new SourceTree(this.root, files);
    const build = new PackageBuild(this.root, this.runner, this.environment, process.platform, process.arch);
    const modules = new ModuleCatalog(this.root);
    const angular = new AngularProject(this.root, this.runner, new NpmCommand(this.runner, this.environment));
    const apis = new ApiCatalog(this.root, new PackageCatalog(this.root), new BuildLayout(this.root), angular, GateChecks.API_PARTS);
    const server = [ApiServer.locateCompiler()];
    const syntax = new SyntaxTreeReader(this.root, server, GateChecks.API_TIMEOUT);
    const checks = [
      new DocumentCheck(this.root, files),
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
      new PackageTestCheck(this.root, build, this.runner, this.environment, flaky, packages),
      new TypeCheck(this.root, this.runner),
      new ApiDeclarationCheck(this.root, apis, server, GateChecks.API_TIMEOUT),
      new ApiDocumentationCheck(this.root, apis, server, GateChecks.API_TIMEOUT),
      new ApiExampleCheck(this.root, apis, this.runner, server, GateChecks.API_TIMEOUT),
      new ScriptTestCheck(this.root, build, this.runner, this.environment, flaky),
      new AngularTestCheck(angular, flaky),
      new PackagedBuildCheck(this.root, new PackagedBuild(this.root, this.runner, new GalleryFile(this.root), angular), angular)
    ];
    return checks.map(t => GateChecks.place(t));
  }

  private static place(check: ICheck): GateCheck {
    if (check instanceof PackageTestCheck)
      return new GateCheck(check, TestPart.PACKAGES, PackageTestCheck.RUNNER);
    if (check instanceof ScriptTestCheck)
      return new GateCheck(check, TestPart.SCRIPTS, ScriptTestCheck.RUNNER);
    return new GateCheck(check, TestPart.ANGULAR_AND_CHECKS, check instanceof AngularTestCheck ? AngularTestCheck.RUNNER : null);
  }
}
