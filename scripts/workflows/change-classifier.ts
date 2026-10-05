/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type Git from "../repository/git.ts";
import GitHubEvent from "./github-event.ts";
import VerificationScope from "./verification-scope.ts";

export default class ChangeClassifier {
  private static readonly REVISION_PATTERN: RegExp = /^[0-9a-f]{40}$/;
  private static readonly MARKDOWN_EXTENSION: string = ".md";
  private static readonly DOCUMENTATION_FOLDERS: readonly string[] = ["docs/", ".github/"];
  private static readonly MODULE_DOCUMENT_PATTERN: RegExp = /^src\/modules\/[^/]+\/README\.md$/;
  private static readonly UI_JOB_PATHS: readonly string[] = [".github/actions/", ".github/workflows/build-and-test.yml", ".github/workflows/ui-workflows.yml"];
  private static readonly OUTSIDE_APP_FOLDERS: readonly string[] = [".github/", "scripts/api/", "scripts/checks/", "scripts/documents/", "scripts/tests/", "scripts/workflows/"];
  private static readonly OUTSIDE_APP_FILES: readonly string[] = [
    ".gitignore",
    "scripts/classify-changes.ts",
    "scripts/test-options.exception.ts",
    "scripts/test-options.ts",
    "scripts/test.ts",
    "scripts/ui-summary.ts",
    "scripts/watch-pull-requests.ts"
  ];
  private static readonly MANUAL_RUN: string = "Events other than pull requests verify everything.";
  private static readonly PUSH: string = "A push to main verifies everything.";
  private static readonly HISTORY_UNAVAILABLE: string = "The revisions to compare are unavailable.";
  private static readonly EMPTY_COMPARISON: string = "The comparison found no changed files.";

  private readonly git: Git;

  public constructor(git: Git) {
    this.git = git;
  }

  public static affectsUiWorkflows(changedPath: string): boolean {
    return ChangeClassifier.UI_JOB_PATHS.some(t => changedPath.startsWith(t))
      || !(ChangeClassifier.OUTSIDE_APP_FILES.includes(changedPath)
        || ChangeClassifier.OUTSIDE_APP_FOLDERS.some(t => changedPath.startsWith(t))
        || ChangeClassifier.isDocumentation(changedPath));
  }

  public async classifyAsync(eventName?: string, baseRevision?: string, headRevision?: string): Promise<VerificationScope> {
    if (eventName === GitHubEvent.PUSH)
      return new VerificationScope(true, true, ChangeClassifier.PUSH);
    if (eventName !== GitHubEvent.PULL_REQUEST)
      return new VerificationScope(true, true, ChangeClassifier.MANUAL_RUN);
    if (baseRevision === undefined || headRevision === undefined || !await this.existsAsync(baseRevision) || !await this.existsAsync(headRevision))
      return new VerificationScope(true, true, ChangeClassifier.HISTORY_UNAVAILABLE);

    const mergeBase = (await this.git.readOutputAsync(["merge-base", baseRevision, headRevision])).trim();
    const changes = await this.git.readOutputAsync(["diff", "--no-renames", "--name-only", "-z", mergeBase, headRevision, "--"]);
    const paths = changes.split("\0").filter(t => t.length > 0);
    if (paths.length === 0)
      return new VerificationScope(true, true, ChangeClassifier.EMPTY_COMPARISON);
    if (paths.every(t => ChangeClassifier.isDocumentation(t)))
      return new VerificationScope(false, false, `Only Markdown documentation changed since the merge base ${mergeBase}.`);
    return paths.some(t => ChangeClassifier.affectsUiWorkflows(t))
      ? new VerificationScope(true, true, `Files the app is built or tested from changed since the merge base ${mergeBase}.`)
      : new VerificationScope(true, false, `Only documentation, CI and test tooling or repository configuration changed since the merge base ${mergeBase}.`);
  }

  private static isDocumentation(changedPath: string): boolean {
    return changedPath.endsWith(ChangeClassifier.MARKDOWN_EXTENSION)
      && (!changedPath.includes("/")
        || ChangeClassifier.DOCUMENTATION_FOLDERS.some(t => changedPath.startsWith(t))
        || ChangeClassifier.MODULE_DOCUMENT_PATTERN.test(changedPath));
  }

  private async existsAsync(revision: string): Promise<boolean> {
    return ChangeClassifier.REVISION_PATTERN.test(revision) && await this.git.succeedsAsync(["cat-file", "-e", `${revision}^{commit}`]);
  }
}
