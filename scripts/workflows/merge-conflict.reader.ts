/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type Git from "../repository/git.ts";

export default class MergeConflictReader {
  private static readonly REMOTE: string = "origin";
  private static readonly BASE: string = "refs/remotes/watch/base";
  private static readonly HEAD: string = "refs/remotes/watch/head";
  private static readonly MERGE_EXIT_CODES: readonly number[] = [0, 1];

  private readonly git: Git;
  private previous: Promise<unknown> = Promise.resolve();

  public constructor(git: Git) {
    this.git = git;
  }

  public readFilesAsync(defaultBranch: string, number: number): Promise<readonly string[]> {
    const files = this.previous.then(() => this.mergeAsync(defaultBranch, number));
    this.previous = files.catch(() => undefined);
    return files;
  }

  private async mergeAsync(defaultBranch: string, number: number): Promise<readonly string[]> {
    await this.git.readOutputAsync(["fetch", "--no-tags", "--quiet", MergeConflictReader.REMOTE,
      `+refs/heads/${defaultBranch}:${MergeConflictReader.BASE}`, `+refs/pull/${number}/head:${MergeConflictReader.HEAD}`]);
    const output = await this.git.readOutputAsync(["merge-tree", "--write-tree", "--name-only", "--no-messages", "-z", MergeConflictReader.BASE, MergeConflictReader.HEAD],
      MergeConflictReader.MERGE_EXIT_CODES);
    return output.split("\0").slice(1).filter(t => t.length > 0);
  }
}
