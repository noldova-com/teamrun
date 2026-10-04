/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type RepositoryFiles from "../repository/repository-files.ts";
import type ICheck from "./interfaces/check.ts";

export default class GitHubConfigurationCheck implements ICheck {
  private static readonly CONFIGURATION_FILE: RegExp = /^\.github\/.+\.ya?ml$/;
  private static readonly USES_LINE: RegExp = /^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)["']?(.*)$/;
  private static readonly PINNED_ACTION: RegExp = /^[^@\s]+@[0-9a-f]{40}$/;
  private static readonly RELEASE_COMMENT: RegExp = /^\s+#\s*\S/;
  private static readonly LOCAL_PREFIX: string = "./";
  private static readonly LINE_SEPARATOR: string = "\n";

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = "GitHub configuration";

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => GitHubConfigurationCheck.CONFIGURATION_FILE.test(t));
    const findings: string[] = [];
    for (const file of files) {
      const lines = (await readFile(path.join(this.root, file), "utf8")).split(GitHubConfigurationCheck.LINE_SEPARATOR);
      lines.forEach((line, index) => {
        const problem = GitHubConfigurationCheck.findProblem(line);
        if (problem !== null)
          findings.push(`${file}:${index + 1}: ${problem}`);
      });
    }

    for (const finding of findings)
      output.write(`${finding}\n`);
    output.write(`Checked ${files.length} GitHub configuration files.\n`);
    return findings.length === 0;
  }

  private static findProblem(line: string): string | null {
    const match = GitHubConfigurationCheck.USES_LINE.exec(line);
    if (match === null)
      return null;
    const [, action = "", rest = ""] = match;
    if (action.startsWith(GitHubConfigurationCheck.LOCAL_PREFIX))
      return null;
    if (!GitHubConfigurationCheck.PINNED_ACTION.test(action))
      return `the action "${action}" is not pinned to a full commit SHA; CODING-STANDARDS.md section 11 requires one.`;
    if (!GitHubConfigurationCheck.RELEASE_COMMENT.test(rest))
      return `the action "${action}" does not record its release version in a comment after the SHA; CODING-STANDARDS.md section 11 requires one.`;
    return null;
  }
}
