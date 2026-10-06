/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type PackageCatalog from "../packages/package-catalog.ts";
import PackageException from "../packages/package.exception.ts";
import type Git from "../repository/git.ts";
import ChangeSelection from "./change-selection.ts";
import ChangeSelector from "./change-selector.ts";
import GitHubEvent from "./github-event.ts";
import VerificationScope from "./verification-scope.ts";

export default class ChangeClassifier {
  private static readonly REVISION_PATTERN: RegExp = /^[0-9a-f]{40}$/;
  private static readonly MARKDOWN_EXTENSION: string = ".md";
  private static readonly DOCUMENTATION_FOLDERS: readonly string[] = ["docs/", ".github/"];
  private static readonly MODULE_DOCUMENT_PATTERN: RegExp = /^src\/modules\/[^/]+\/README\.md$/;
  private static readonly UI_JOB_PATHS: readonly string[] = [".github/actions/", ".github/workflows/build-and-test.yml", ".github/workflows/ui-workflows.yml"];
  private static readonly OUTSIDE_APP_FOLDERS: readonly string[] = [".github/", "scripts/api/", "scripts/checks/", "scripts/documents/", "scripts/packaging/", "scripts/release/", "scripts/tests/", "scripts/workflows/"];
  private static readonly OUTSIDE_APP_FILES: readonly string[] = [
    ".gitignore",
    "scripts/classify-changes.ts",
    "scripts/flaky-report.ts",
    "scripts/flaky-week-summary.ts",
    "scripts/package-smoke.ts",
    "scripts/package.ts",
    "scripts/release-assets.ts",
    "scripts/release-check.ts",
    "scripts/release-publish.ts",
    "scripts/repeat-plan.ts",
    "scripts/test-options.exception.ts",
    "scripts/test-options.ts",
    "scripts/test-part.ts",
    "scripts/test.ts",
    "scripts/ui-summary.ts",
    "scripts/watch-pull-requests.ts"
  ];
  private static readonly MANUAL_RUN: string = "Events other than pull requests and merge groups verify everything.";
  private static readonly PUSH: string = "A push to main verifies everything.";
  private static readonly HISTORY_UNAVAILABLE: string = "The revisions to compare are unavailable.";
  private static readonly EMPTY_COMPARISON: string = "The comparison found no changed files.";
  private static readonly MERGE_GROUP: string = "A merge group always runs its level in full.";

  private readonly git: Git;
  private readonly catalog: PackageCatalog;

  public constructor(git: Git, catalog: PackageCatalog) {
    this.git = git;
    this.catalog = catalog;
  }

  public static affectsUiWorkflows(changedPath: string): boolean {
    return ChangeClassifier.UI_JOB_PATHS.some(t => changedPath.startsWith(t))
      || !(ChangeClassifier.OUTSIDE_APP_FILES.includes(changedPath)
        || ChangeClassifier.OUTSIDE_APP_FOLDERS.some(t => changedPath.startsWith(t))
        || ChangeClassifier.isDocumentation(changedPath));
  }

  public static classifyPaths(paths: readonly string[], mergeBase: string, selection: ChangeSelection): VerificationScope {
    if (paths.length === 0)
      return new VerificationScope(true, true, ChangeClassifier.EMPTY_COMPARISON, ChangeSelection.everything(ChangeClassifier.EMPTY_COMPARISON));
    if (paths.every(t => ChangeClassifier.isDocumentation(t)))
      return new VerificationScope(false, false, `Only Markdown documentation changed since the merge base ${mergeBase}.`, selection);
    return paths.some(t => ChangeClassifier.affectsUiWorkflows(t))
      ? new VerificationScope(true, true, `Files the app is built or tested from changed since the merge base ${mergeBase}.`, selection)
      : new VerificationScope(true, false, `Only documentation, CI and test tooling or repository configuration changed since the merge base ${mergeBase}.`, selection);
  }

  public static selectPaths(paths: readonly string[], selector: ChangeSelector): ChangeSelection {
    const code = paths.filter(t => !ChangeClassifier.isDocumentation(t));
    return selector.select(code.filter(t => ChangeClassifier.affectsUiWorkflows(t)), code.filter(t => !ChangeClassifier.affectsUiWorkflows(t)));
  }

  public async classifyAsync(eventName?: string, baseRevision?: string, headRevision?: string): Promise<VerificationScope> {
    if (eventName === GitHubEvent.PUSH)
      return ChangeClassifier.everything(ChangeClassifier.PUSH);
    if (eventName === undefined || !GitHubEvent.PULL_REQUEST_LEVEL.includes(eventName))
      return ChangeClassifier.everything(ChangeClassifier.MANUAL_RUN);
    if (baseRevision === undefined || headRevision === undefined || !await this.existsAsync(baseRevision) || !await this.existsAsync(headRevision))
      return ChangeClassifier.everything(ChangeClassifier.HISTORY_UNAVAILABLE);

    const mergeBase = (await this.git.readOutputAsync(["merge-base", baseRevision, headRevision])).trim();
    const changes = await this.git.readOutputAsync(["diff", "--no-renames", "--name-only", "-z", mergeBase, headRevision, "--"]);
    const paths = changes.split("\0").filter(t => t.length > 0);
    return ChangeClassifier.classifyPaths(paths, mergeBase, eventName === GitHubEvent.MERGE_GROUP
      ? ChangeSelection.everything(ChangeClassifier.MERGE_GROUP)
      : await this.selectAsync(paths));
  }

  private static everything(reason: string): VerificationScope {
    return new VerificationScope(true, true, reason, ChangeSelection.everything(reason));
  }

  private static isDocumentation(changedPath: string): boolean {
    return changedPath.endsWith(ChangeClassifier.MARKDOWN_EXTENSION)
      && (!changedPath.includes("/")
        || ChangeClassifier.DOCUMENTATION_FOLDERS.some(t => changedPath.startsWith(t))
        || ChangeClassifier.MODULE_DOCUMENT_PATTERN.test(changedPath));
  }

  private async selectAsync(paths: readonly string[]): Promise<ChangeSelection> {
    try {
      return ChangeClassifier.selectPaths(paths, new ChangeSelector(await this.catalog.listPackagesAsync(false)));
    }
    catch (error) {
      if (!(error instanceof PackageException))
        throw error;
      return ChangeSelection.everything(`The packages could not be read: ${error.message}`);
    }
  }

  private async existsAsync(revision: string): Promise<boolean> {
    return ChangeClassifier.REVISION_PATTERN.test(revision) && await this.git.succeedsAsync(["cat-file", "-e", `${revision}^{commit}`]);
  }
}
