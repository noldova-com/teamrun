/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import DevelopmentBinary from "../../desktop/development-binary.ts";
import ProcessRunnerFixture from "./process-runner.fixture.ts";

export default class PreparedBinaryFixture extends DevelopmentBinary {
  public static readonly EXECUTABLE: string = path.resolve("development-app", "fixture-studio");

  private readonly failure: Error | null;

  public constructor(failure: Error | null = null) {
    super(path.resolve("repository"), new ProcessRunnerFixture());

    this.failure = failure;
  }

  public override async prepareAsync(report: Writable): Promise<string> {
    if (this.failure !== null)
      throw this.failure;
    report.write("prepared\n");
    return PreparedBinaryFixture.EXECUTABLE;
  }
}
