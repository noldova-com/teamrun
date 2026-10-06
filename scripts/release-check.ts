/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import ReleaseException from "./release/release.exception.ts";
import ReleaseRequest from "./release/release-request.ts";
import ReleaseSigning from "./release/release-signing.ts";
import ReleaseVersion from "./release/release-version.ts";
import GitHubApi from "./repository/github-api.ts";
import GitHubException from "./repository/github.exception.ts";
import GitHubJson from "./repository/github-json.ts";

export default class ReleaseCheck {
  private static readonly USAGE: string = "Usage: RELEASE_REPOSITORY=<owner/name> RELEASE_VERSION=<N.N.N> RELEASE_REVISION=<commit> npm run release:check\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly MAIN: string = "main";
  private static readonly ON_MAIN: readonly string[] = ["identical", "ahead"];
  private static readonly BUILD_RUNS: string = "/actions/workflows/build-and-test.yml/runs?event=push&branch=main&per_page=1&head_sha=";
  private static readonly SUCCESS: string = "success";
  private static readonly OUTPUT_VARIABLE: string = "GITHUB_OUTPUT";
  private static readonly SIGNED_OUTPUT: string = "signed";

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
    const signed = (await ReleaseSigning.readAsync(this.root)).listSignedPlatforms(manifest.product, request.repository);
    if (manifest.productVersion !== request.version.text)
      throw new ReleaseException(`The root manifest's version is ${manifest.productVersion}, not ${request.version.text}; raise it on main first.`);

    const api = new GitHubApi(request.repository, this.runner, this.root);
    const latest = await api.readOptionalAsync("/releases/latest");
    if (latest !== null) {
      const latestVersion = ReleaseVersion.parseTag(GitHubJson.text(GitHubJson.object(latest, "the latest release"), "tag_name", "the latest release"), "The latest release's tag");
      if (!request.version.isNewerThan(latestVersion))
        throw new ReleaseException(`${request.version.text} is not newer than the latest release, ${latestVersion.text}.`);
    }

    if (await api.readOptionalAsync(`/git/ref/tags/${request.version.tag}`) !== null)
      throw new ReleaseException(`The tag ${request.version.tag} already exists; a published tag is never moved.`);

    const comparison = await api.readOptionalAsync(`/compare/${request.revision}...${ReleaseCheck.MAIN}`);
    if (comparison === null)
      throw new ReleaseException(`${request.revision} is not a commit of ${request.repository}.`);
    const status = GitHubJson.text(GitHubJson.object(comparison, "the comparison with main"), "status", "the comparison with main");
    if (!ReleaseCheck.ON_MAIN.includes(status))
      throw new ReleaseException(`${request.revision} is not on ${ReleaseCheck.MAIN}; ${ReleaseCheck.MAIN} is ${status} compared with it.`);

    const runs = GitHubJson.children(GitHubJson.object(await api.readAsync(`${ReleaseCheck.BUILD_RUNS}${request.revision}`), "Build and test runs"), "workflow_runs", "Build and test runs");
    const run = runs.at(0);
    if (run === undefined)
      throw new ReleaseException(`No Build and test run on ${ReleaseCheck.MAIN} has checked ${request.revision}; release a revision whose run on ${ReleaseCheck.MAIN} passed.`);
    const conclusion = GitHubJson.nullableText(run, "conclusion", "the Build and test run") ?? GitHubJson.text(run, "status", "the Build and test run");
    if (conclusion !== ReleaseCheck.SUCCESS)
      throw new ReleaseException(`The Build and test run on ${ReleaseCheck.MAIN} for ${request.revision} is ${conclusion}, not ${ReleaseCheck.SUCCESS}; `
        + `release a revision whose run on ${ReleaseCheck.MAIN} passed.`);
    const output = this.environment[ReleaseCheck.OUTPUT_VARIABLE];
    if (output !== undefined)
      await appendFile(output, `${ReleaseCheck.SIGNED_OUTPUT}=${JSON.stringify(signed)}\n`);
    this.output.write(`${request.version.tag} of ${request.repository} from ${request.revision}: the version is new, the revision is on ${ReleaseCheck.MAIN} `
      + `and its Build and test run there passed. Signed platforms: ${signed.length === 0 ? "none" : signed.join(", ")}.\n`);
  }
}

if (import.meta.main)
  process.exitCode = await new ReleaseCheck(process.cwd(), new ProcessRunner(), process.env, process.stdout).runAsync(process.argv.slice(2));
