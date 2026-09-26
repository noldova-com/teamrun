/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync } from "node:fs";

import PackageException from "./packaging/package.exception.ts";
import ReleaseAssets from "./release/release-assets.ts";
import ReleaseCandidate from "./release/release-candidate.ts";

export default class ValidateRelease {
  private static readonly OUTPUT_VARIABLE: string = "GITHUB_OUTPUT";
  private static readonly TAG_VARIABLE: string = "RELEASE_TAG";
  private static readonly SIGNED_PLATFORMS_VARIABLE: string = "RELEASE_SIGNED_PLATFORMS";
  private static readonly OUTPUT_REQUIRED: string = "GITHUB_OUTPUT is required.";

  public run(environment: NodeJS.ProcessEnv = process.env): void {
    const output = environment[ValidateRelease.OUTPUT_VARIABLE];
    if (!output)
      throw new PackageException(ValidateRelease.OUTPUT_REQUIRED);
    const signedPlatforms = ReleaseAssets.parseSignedPlatforms(environment[ValidateRelease.SIGNED_PLATFORMS_VARIABLE]);
    new ReleaseCandidate(environment[ValidateRelease.TAG_VARIABLE] ?? "").writeOutputs(output);
    appendFileSync(output, `signed-platforms=${JSON.stringify(signedPlatforms)}\n`);
  }
}

if (import.meta.main)
  new ValidateRelease().run();
