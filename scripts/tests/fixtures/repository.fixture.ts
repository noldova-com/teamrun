/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ExecutableLocator from "../../processes/executable-locator.ts";

export default class RepositoryFixture {
  private static readonly PREFIX: string = "teamrun-fixture-";
  private static readonly TIMEOUT: number = 10_000;
  private static readonly IDENTITY: readonly string[] = ["-c", "user.name=TeamRun Fixture", "-c", "user.email=fixture@example.invalid"];

  private readonly root: string;
  private readonly environment: NodeJS.ProcessEnv;

  public readonly directory: string;

  private constructor(root: string) {
    this.root = root;
    this.environment = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(root, "gitconfig") };
    this.directory = path.join(root, "repository");
  }

  public static async createAsync(): Promise<RepositoryFixture> {
    const fixture = new RepositoryFixture(await mkdtemp(path.join(tmpdir(), RepositoryFixture.PREFIX)));
    await writeFile(path.join(fixture.root, "gitconfig"), "");
    await mkdir(fixture.directory);
    fixture.git(["init", "--quiet", "--initial-branch=main"]);
    return fixture;
  }

  public async writeAsync(files: Readonly<Record<string, string | Buffer>>): Promise<void> {
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(this.directory, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
    }
  }

  public async commitAsync(files: Readonly<Record<string, string | Buffer>>): Promise<string> {
    await this.writeAsync(files);
    this.git(["add", "--all"]);
    this.git(["commit", "--quiet", "--allow-empty", "--message", "Fixture change"]);
    return this.git(["rev-parse", "HEAD"]).trim();
  }

  public git(gitArguments: readonly string[]): string {
    const result = spawnSync(ExecutableLocator.locate("git"), [...RepositoryFixture.IDENTITY, ...gitArguments], {
      cwd: this.directory, env: this.environment, encoding: "utf8", timeout: RepositoryFixture.TIMEOUT
    });
    assert.equal(result.status, 0, `git ${gitArguments.join(" ")}: ${result.stderr}`);
    return result.stdout;
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }
}
