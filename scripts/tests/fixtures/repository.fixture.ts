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
import { setTimeout as delay } from "node:timers/promises";

import ExecutableLocator from "../../processes/executable-locator.ts";

export default class RepositoryFixture {
  private static readonly PREFIX: string = "teamrun-fixture-";
  private static readonly TIMEOUT: number = 10_000;
  private static readonly REMOVE_LIMIT: number = 10_000;
  private static readonly REMOVE_INTERVAL: number = 250;
  private static readonly LOCKED_CODES: readonly string[] = ["EBUSY", "EPERM", "ENOTEMPTY"];
  private static readonly WINDOWS_USERS: string = "Microsoft.PowerShell.Management\\Get-WmiObject -Query 'SELECT ProcessId, ExecutablePath, CommandLine FROM Win32_Process' | " +
    "Microsoft.PowerShell.Core\\Where-Object { $_.ProcessId -ne $PID -and ($_.ExecutablePath -like 'FOLDER*' -or $_.CommandLine -like '*FOLDER*') } | " +
    "Microsoft.PowerShell.Core\\ForEach-Object { \"$($_.ProcessId) $($_.CommandLine)\" }";
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
    const deadline = Date.now() + RepositoryFixture.REMOVE_LIMIT;
    for (;;)
      try {
        await rm(this.root, { recursive: true, force: true });
        return;
      }
      catch (error) {
        if (!RepositoryFixture.LOCKED_CODES.includes((error as NodeJS.ErrnoException).code ?? ""))
          throw error;
        if (Date.now() >= deadline)
          throw new Error(`${this.root} stayed locked for ${RepositoryFixture.REMOVE_LIMIT / 1000} s. Processes started from it or naming it: ${RepositoryFixture.describeUsers(this.root)}`, { cause: error });
        await delay(RepositoryFixture.REMOVE_INTERVAL);
      }
  }

  private static describeUsers(folder: string): string {
    const result = process.platform === "win32"
      ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", RepositoryFixture.WINDOWS_USERS.replaceAll("FOLDER", folder.replaceAll("'", "''"))],
        { encoding: "utf8", windowsHide: true, timeout: RepositoryFixture.TIMEOUT })
      : spawnSync("ps", ["-A", "-ww", "-o", "pid=,args="], { encoding: "utf8", timeout: RepositoryFixture.TIMEOUT });
    if (result.status !== 0)
      return `unknown (${result.error?.message ?? result.stderr.trim()})`;
    const users = result.stdout.split(/\r?\n/).filter(t => t.trim().length > 0 && (process.platform === "win32" || t.includes(folder)));
    return users.length === 0 ? "none listed" : users.join("; ");
  }
}
