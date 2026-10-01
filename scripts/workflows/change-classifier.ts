/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type Git from "../repository/git.ts";
import VerificationScope from "./verification-scope.ts";

export default class ChangeClassifier {
  private static readonly PUSH_EVENT: string = "push";
  private static readonly MERGE_BASE_EVENTS: readonly string[] = ["pull_request", "merge_group"];
  private static readonly REVISION_PATTERN: RegExp = /^[0-9a-f]{40}$/;
  private static readonly MARKDOWN_EXTENSION: string = ".md";
  private static readonly DOCUMENTATION_FOLDERS: readonly string[] = ["docs/", ".github/"];
  private static readonly MODULE_DOCUMENT_PATTERN: RegExp = /^src\/modules\/[^/]+\/README\.md$/;
  private static readonly MANUAL_RUN: string = "Events other than pull requests, merge groups and pushes verify everything.";
  private static readonly HISTORY_UNAVAILABLE: string = "The revisions to compare are unavailable.";
  private static readonly EMPTY_COMPARISON: string = "The comparison found no changed files.";

  private readonly git: Git;

  public constructor(git: Git) {
    this.git = git;
  }

  public async classifyAsync(eventName?: string, baseRevision?: string, headRevision?: string): Promise<VerificationScope> {
    const isPush = eventName === ChangeClassifier.PUSH_EVENT;
    if (eventName === undefined || !(isPush || ChangeClassifier.MERGE_BASE_EVENTS.includes(eventName)))
      return new VerificationScope(true, ChangeClassifier.MANUAL_RUN);
    if (baseRevision === undefined || headRevision === undefined || !await this.existsAsync(baseRevision) || !await this.existsAsync(headRevision))
      return new VerificationScope(true, ChangeClassifier.HISTORY_UNAVAILABLE);

    const comparison = isPush ? baseRevision : (await this.git.readOutputAsync(["merge-base", baseRevision, headRevision])).trim();
    const description = isPush ? `the previous revision ${comparison}` : `the merge base ${comparison}`;
    const changes = await this.git.readOutputAsync(["diff", "--no-renames", "--name-only", "-z", comparison, headRevision, "--"]);
    const paths = changes.split("\0").filter(t => t.length > 0);
    if (paths.length === 0)
      return new VerificationScope(true, ChangeClassifier.EMPTY_COMPARISON);
    return paths.every(t => ChangeClassifier.isDocumentation(t))
      ? new VerificationScope(false, `Only Markdown documentation changed since ${description}.`)
      : new VerificationScope(true, `Files other than Markdown documentation changed since ${description}.`);
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
