/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageException from "./packaging/package.exception.ts";
import ReleaseCandidate from "./release/release-candidate.ts";

export default class ValidateRelease {
  private static readonly OUTPUT_VARIABLE: string = "GITHUB_OUTPUT";
  private static readonly TAG_VARIABLE: string = "RELEASE_TAG";
  private static readonly OUTPUT_REQUIRED: string = "GITHUB_OUTPUT is required.";

  public run(environment: NodeJS.ProcessEnv = process.env): void {
    const output = environment[ValidateRelease.OUTPUT_VARIABLE];
    if (!output)
      throw new PackageException(ValidateRelease.OUTPUT_REQUIRED);
    new ReleaseCandidate(environment[ValidateRelease.TAG_VARIABLE] ?? "").writeOutputs(output);
  }
}

if (import.meta.main)
  new ValidateRelease().run();
