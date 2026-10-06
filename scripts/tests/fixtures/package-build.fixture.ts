/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageBuild from "../../packages/package-build.ts";
import ProcessRunner from "../../processes/process-runner.ts";

export default class PackageBuildFixture extends PackageBuild {
  private readonly failure: Error | null;

  public constructor(root: string, failure: Error | null = null) {
    super(root, new ProcessRunner(), process.env, process.platform, process.arch);

    this.failure = failure;
  }

  public override async requireCurrentAsync(): Promise<void> {
    if (this.failure !== null)
      throw this.failure;
  }
}
