/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { SetVersionException } from "./packages/set-version.exception.ts";
import { VersionSetter } from "./packages/version-setter.ts";

export class SetVersion {
  private static readonly USAGE: string = "Usage: npm run set-version -- <major.minor.patch> [<released commit>]\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly FAILURE_EXIT_CODE: number = 1;
  private static readonly COMMIT_PATTERN: RegExp = /^[0-9a-f]{40}$/;

  private readonly root: string;
  private readonly output: Writable;
  private readonly readCommitFile: (commit: string, file: string) => string;

  public constructor(root: string, output: Writable, readCommitFile: (commit: string, file: string) => string) {
    this.root = root;
    this.output = output;
    this.readCommitFile = readCommitFile;
  }

  public async runAsync(args: readonly string[]): Promise<number> {
    const [version, commit, ...rest] = args;
    if (Object.isUndefined(version) || rest.length > 0 || (!Object.isUndefined(commit) && !SetVersion.COMMIT_PATTERN.test(commit))) {
      this.output.write(SetVersion.USAGE);
      return SetVersion.USAGE_EXIT_CODE;
    }
    try {
      const released = Object.isUndefined(commit) ? null : this.readCommitFile(commit, VersionSetter.CHANGELOG_FILE);
      const previous = await new VersionSetter(this.root).setAsync(version, released);
      this.output.write(Object.isUndefined(commit)
        ? `Set the version from ${previous} to ${version}, and named it over the changelog's unreleased entries.\n`
        : `Set the version from ${previous} to ${version}, and named it over the changelog's entries that ${commit} released.\n`);
      return 0;
    }
    catch (error) {
      if (!(error instanceof SetVersionException))
        throw error;
      this.output.write(`${error.message}\n`);
      return SetVersion.FAILURE_EXIT_CODE;
    }
  }
}

if (import.meta.main) {
  const root = process.cwd();
  const readCommitFile = (commit: string, file: string): string => {
    try {
      return execFileSync("git", ["show", `${commit}:${file}`], { cwd: root, encoding: "utf8" });
    }
    catch (error) {
      throw new SetVersionException(`${file} at ${commit} can't be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  process.exitCode = await new SetVersion(root, process.stdout, readCommitFile).runAsync(process.argv.slice(2));
}
