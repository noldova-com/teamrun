/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import ReleaseException from "./release/release.exception.ts";
import ReleaseRequest from "./release/release-request.ts";
import ReleaseVersion from "./release/release-version.ts";
import GitHubApi from "./repository/github-api.ts";
import GitHubException from "./repository/github.exception.ts";
import GitHubJson from "./repository/github-json.ts";

export default class ReleaseCheck {
  private static readonly USAGE: string = "Usage: RELEASE_REPOSITORY=<owner/name> RELEASE_VERSION=<N.N.N> RELEASE_REVISION=<commit> npm run release:check\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly MAIN: string = "main";
  private static readonly ON_MAIN: readonly string[] = ["identical", "ahead"];
  private static readonly NOT_FOUND: number = 404;

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
  }

  private static async readOrNullAsync(api: GitHubApi, resource: string): Promise<unknown> {
    try {
      return await api.readAsync(resource);
    }
    catch (error) {
      if (error instanceof GitHubException && error.status === ReleaseCheck.NOT_FOUND)
        return null;
      throw error;
    }
  }

  public async runAsync(checkArguments: readonly string[]): Promise<number> {
    if (checkArguments.length > 0) {
      this.output.write(ReleaseCheck.USAGE);
      return ReleaseCheck.USAGE_EXIT_CODE;
    }
    try {
      await this.checkAsync();
      return 0;
    }
    catch (error) {
      if (!(error instanceof ReleaseException || error instanceof GitHubException || error instanceof PackageException || error instanceof ProcessException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }

  private async checkAsync(): Promise<void> {
    const request = ReleaseRequest.read(this.environment);
    const manifest = await RootManifest.readAsync(this.root);
    if (manifest.productVersion !== request.version.text)
      throw new ReleaseException(`The root manifest's version is ${manifest.productVersion}, not ${request.version.text}; raise it on main first.`);

    const api = new GitHubApi(request.repository, this.runner, this.root);
    const latest = await ReleaseCheck.readOrNullAsync(api, "/releases/latest");
    if (latest !== null) {
      const latestVersion = ReleaseVersion.parseTag(GitHubJson.text(GitHubJson.object(latest, "the latest release"), "tag_name", "the latest release"), "The latest release's tag");
      if (!request.version.isNewerThan(latestVersion))
        throw new ReleaseException(`${request.version.text} is not newer than the latest release, ${latestVersion.text}.`);
    }

    const comparison = await ReleaseCheck.readOrNullAsync(api, `/compare/${request.revision}...${ReleaseCheck.MAIN}`);
    if (comparison === null)
      throw new ReleaseException(`${request.revision} is not a commit of ${request.repository}.`);
    const status = GitHubJson.text(GitHubJson.object(comparison, "the comparison with main"), "status", "the comparison with main");
    if (!ReleaseCheck.ON_MAIN.includes(status))
      throw new ReleaseException(`${request.revision} is not on ${ReleaseCheck.MAIN}; ${ReleaseCheck.MAIN} is ${status} compared with it.`);
    this.output.write(`${request.version.tag} of ${request.repository} from ${request.revision}: the version is new and the revision is on ${ReleaseCheck.MAIN}.\n`);
  }
}

if (import.meta.main)
  process.exitCode = await new ReleaseCheck(process.cwd(), new ProcessRunner(), process.env, process.stdout).runAsync(process.argv.slice(2));
