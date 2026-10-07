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
  private static readonly UPLOAD_TIMEOUT: number = 900_000;
  private static readonly NOT_FOUND: number = 404;
  private static readonly STATUS_PATTERN: RegExp = /\bHTTP (\d{3})\b/u;
  private static readonly TAG_REFERENCES: string = "/git/matching-refs/tags/";
  private static readonly TAG_PREFIX: string = "refs/tags/";

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

  public async readTagAsync(tag: string): Promise<Readonly<Record<string, unknown>> | null> {
    const context = `the references of the tag ${tag}`;
    const reference = `${GitHubApi.TAG_PREFIX}${tag}`;
    return GitHubJson.array(await this.readAsync(`${GitHubApi.TAG_REFERENCES}${tag}`), context)
      .map(t => GitHubJson.object(t, context))
      .find(t => GitHubJson.text(t, "ref", context) === reference) ?? null;
  }

  public async readOptionalAsync(resource: string): Promise<unknown> {
    try {
      return await this.readAsync(resource);
    }
    catch (error) {
      if (error instanceof GitHubException && error.status === GitHubApi.NOT_FOUND)
        return null;
      throw error;
    }
  }

  public async writeAsync(method: string, resource: string, body: string): Promise<void> {
    await this.captureAsync(this.formatRequest(method, resource, [["body", body]], []));
  }

  public createAsync(resource: string, fields: readonly (readonly [string, string])[]): Promise<unknown> {
    return this.sendAsync("POST", resource, fields, []);
  }

  public async postAsync(resource: string): Promise<void> {
    await this.captureAsync(this.formatRequest("POST", resource, [], []));
  }

  public async sendAsync(method: string, resource: string, texts: readonly (readonly [string, string])[], flags: readonly (readonly [string, boolean | number])[]): Promise<unknown> {
    return this.parse(await this.captureAsync(this.formatRequest(method, resource, texts, flags)), resource);
  }

  public async deleteAsync(resource: string): Promise<void> {
    await this.captureAsync(this.formatRequest("DELETE", resource, [], []));
  }

  public async uploadAsync(tag: string, file: string): Promise<void> {
    await this.captureAsync(["release", "upload", tag, file, "--repo", this.repository], GitHubApi.UPLOAD_TIMEOUT);
  }

  private formatRequest(method: string, resource: string, texts: readonly (readonly [string, string])[], flags: readonly (readonly [string, boolean | number])[]): readonly string[] {
    return ["api", "--method", method, this.locate(resource), ...texts.flatMap(([name, value]) => ["--raw-field", `${name}=${value}`]),
      ...flags.flatMap(([name, value]) => ["--field", `${name}=${value}`])];
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

  private async captureAsync(gitHubArguments: readonly string[], timeout: number = GitHubApi.TIMEOUT): Promise<string> {
    const result = await this.runner.captureAsync(this.executable, gitHubArguments, this.directory, timeout);
    if (!result.isSuccessful) {
      const status = GitHubApi.STATUS_PATTERN.exec(result.errorOutput);
      throw new GitHubException(`"gh ${gitHubArguments.join(" ")}" failed with exit code ${result.exitCode}: ${result.errorOutput.trim()}`, undefined,
        status === null ? null : Number(status[1]));
    }
    return result.output;
  }
}
