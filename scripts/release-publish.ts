/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import ReleaseException from "./release/release.exception.ts";
import ReleaseFileSet from "./release/release-file-set.ts";
import ReleaseNotes from "./release/release-notes.ts";
import ReleasePublisher from "./release/release-publisher.ts";
import ReleaseRequest from "./release/release-request.ts";
import SupportedTargets from "./release/supported-targets.ts";
import GitHubApi from "./repository/github-api.ts";
import GitHubException from "./repository/github.exception.ts";

export default class ReleasePublish {
  private static readonly USAGE: string = "Usage: RELEASE_REPOSITORY=<owner/name> RELEASE_VERSION=<N.N.N> RELEASE_REVISION=<commit> RELEASE_FOLDER=<folder> "
    + "RELEASE_RUN_URL=<url> npm run release:publish\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly FOLDER_VARIABLE: string = "RELEASE_FOLDER";
  private static readonly RUN_VARIABLE: string = "RELEASE_RUN_URL";
  private static readonly LABEL_MARK: string = "#";

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

  public async runAsync(publishArguments: readonly string[]): Promise<number> {
    if (publishArguments.length > 0) {
      this.output.write(ReleasePublish.USAGE);
      return ReleasePublish.USAGE_EXIT_CODE;
    }
    try {
      await this.publishAsync();
      return 0;
    }
    catch (error) {
      if (!(error instanceof ReleaseException || error instanceof GitHubException || error instanceof PackageException || error instanceof ProcessException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }

  private async publishAsync(): Promise<void> {
    const request = ReleaseRequest.read(this.environment);
    const folder = this.environment[ReleasePublish.FOLDER_VARIABLE] ?? "";
    if (!path.isAbsolute(folder))
      throw new ReleaseException(`${ReleasePublish.FOLDER_VARIABLE} must be the absolute path of the folder that holds the release's files, not "${folder}".`);
    if (folder.includes(ReleasePublish.LABEL_MARK))
      throw new ReleaseException(`${ReleasePublish.FOLDER_VARIABLE} must not contain ${ReleasePublish.LABEL_MARK}, which gh release upload reads as the start of a file's label: "${folder}".`);
    const manifest = await RootManifest.readAsync(this.root);
    const notes = ReleaseNotes.compose(manifest.product, await SupportedTargets.readAsync(this.root), request.repository, request.version, this.environment[ReleasePublish.RUN_VARIABLE] ?? "");
    const files = await new ReleaseFileSet(manifest.product.name).verifyAsync(folder, request.version.text);
    await new ReleasePublisher(new GitHubApi(request.repository, this.runner, this.root), this.output).publishAsync(request.version, request.revision, folder, files, notes);
  }
}

if (import.meta.main)
  process.exitCode = await new ReleasePublish(process.cwd(), new ProcessRunner(), process.env, process.stdout).runAsync(process.argv.slice(2));
