/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export class GitRepository {
  public static readonly AUTHOR: string = "Site Author <author@example.com>";
  public readonly folder: string;
  private readonly home: string;

  private constructor(folder: string, home: string) {
    this.folder = folder;
    this.home = home;
  }

  public static create(work: string): GitRepository {
    const repository = new GitRepository(path.join(work, "site"), path.join(work, "git-home"));
    mkdirSync(repository.folder);
    mkdirSync(repository.home);
    repository.git("init", "--quiet", "--initial-branch=main");
    repository.git("config", "user.name", "Site Author");
    repository.git("config", "user.email", "author@example.com");
    repository.write("README.md", "# Site\n");
    repository.git("add", "README.md");
    repository.git("commit", "--quiet", "--message=Start the site");
    return repository;
  }

  public write(name: string, text: string): void {
    writeFileSync(path.join(this.folder, name), text);
  }

  public git(...args: string[]): string {
    const inherited = Object.entries(process.env).filter(([name]) => !/^GIT_(AUTHOR|COMMITTER)_/.test(name));
    const env = { ...Object.fromEntries(inherited), HOME: this.home, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(this.home, ".gitconfig") };
    const result = spawnSync("git", args, { cwd: this.folder, encoding: "utf8", env });
    if (result.status !== 0)
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    return result.stdout.trim();
  }
}
