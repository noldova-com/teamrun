/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import PackageException from "./packaging/package.exception.ts";
import ReleaseAssets from "./release/release-assets.ts";
import ReleaseCandidate from "./release/release-candidate.ts";
import ReleasePublisher from "./release/release-publisher.ts";

export default class PublishRelease {
  private static readonly REPOSITORY_VARIABLE: string = "GITHUB_REPOSITORY";
  private static readonly REVISION_VARIABLE: string = "RELEASE_REVISION";
  private static readonly TAG_VARIABLE: string = "RELEASE_TAG";
  private static readonly TOKEN_VARIABLE: string = "GH_TOKEN";
  private static readonly SIGNED_PLATFORMS_VARIABLE: string = "RELEASE_SIGNED_PLATFORMS";
  private static readonly INPUT_DIRECTORY: string = "_build/release-input";
  private static readonly OUTPUT_DIRECTORY: string = "_build/release";
  private static readonly NOTES_FILE: string = ".github/RELEASE-NOTES.md";
  private static readonly ENVIRONMENT_REQUIRED: string = "The publication repository and validated revision are required.";

  public async runAsync(environment: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (environment[PublishRelease.REPOSITORY_VARIABLE] !== ReleaseCandidate.REPOSITORY || !environment[PublishRelease.REVISION_VARIABLE])
      throw new PackageException(PublishRelease.ENVIRONMENT_REQUIRED);
    const candidate = new ReleaseCandidate(environment[PublishRelease.TAG_VARIABLE] ?? "", process.cwd(), environment[PublishRelease.REVISION_VARIABLE]);
    const signedPlatforms = ReleaseAssets.parseSignedPlatforms(environment[PublishRelease.SIGNED_PLATFORMS_VARIABLE]);
    const files = await new ReleaseAssets(candidate, signedPlatforms).prepare(PublishRelease.INPUT_DIRECTORY, PublishRelease.OUTPUT_DIRECTORY);
    await new ReleasePublisher(candidate, environment[PublishRelease.TOKEN_VARIABLE] ?? "").publish(files, await readFile(PublishRelease.NOTES_FILE, "utf8"));
  }
}

if (import.meta.main)
  await new PublishRelease().runAsync();
