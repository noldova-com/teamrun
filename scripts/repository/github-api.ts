/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ExecutableLocator from "../processes/executable-locator.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import GitHubException from "./github.exception.ts";
import GitHubJson from "./github-json.ts";

export default class GitHubApi {
  private static readonly NAME: string = "gh";
  private static readonly TIMEOUT: number = 60_000;
  private static readonly STATUS_PATTERN: RegExp = /\(HTTP (\d{3})\)/u;

  private readonly repository: string;
  private readonly runner: ProcessRunner;
  private readonly directory: string;
  private readonly executable: string;

  public constructor(repository: string, runner: ProcessRunner, directory: string) {
    this.repository = repository;
    this.runner = runner;
    this.directory = directory;
    this.executable = ExecutableLocator.locate(GitHubApi.NAME);
  }

  public async readAsync(resource: string): Promise<unknown> {
    return this.parse(await this.captureAsync(["api", this.locate(resource)]), resource);
  }

  public async readPagesAsync(resource: string): Promise<readonly unknown[]> {
    const pages = this.parse(await this.captureAsync(["api", "--paginate", "--slurp", this.locate(resource)]), resource);
    return GitHubJson.array(pages, resource).flatMap(t => GitHubJson.array(t, resource));
  }

  public async writeAsync(method: string, resource: string, body: string): Promise<void> {
    await this.captureAsync(["api", "--method", method, this.locate(resource), "--raw-field", `body=${body}`]);
  }

  public async createAsync(resource: string, fields: readonly (readonly [string, string])[]): Promise<unknown> {
    return this.parse(await this.captureAsync(["api", "--method", "POST", this.locate(resource), ...fields.flatMap(([name, value]) => ["--raw-field", `${name}=${value}`])]), resource);
  }

  public async postAsync(resource: string): Promise<void> {
    await this.captureAsync(["api", "--method", "POST", this.locate(resource)]);
  }

  private locate(resource: string): string {
    return `repos/${this.repository}${resource}`;
  }

  private parse(output: string, resource: string): unknown {
    try {
      return JSON.parse(output);
    }
    catch (error) {
      throw new GitHubException(`GitHub's answer for ${resource} is not JSON.`, { cause: error });
    }
  }

  private async captureAsync(gitHubArguments: readonly string[]): Promise<string> {
    const result = await this.runner.captureAsync(this.executable, gitHubArguments, this.directory, GitHubApi.TIMEOUT);
    if (!result.isSuccessful) {
      const status = GitHubApi.STATUS_PATTERN.exec(result.errorOutput);
      throw new GitHubException(`"gh ${gitHubArguments.join(" ")}" failed with exit code ${result.exitCode}: ${result.errorOutput.trim()}`, undefined,
        status === null ? null : Number(status[1]));
    }
    return result.output;
  }
}
