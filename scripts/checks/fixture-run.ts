/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessResult } from "../processes/process-result.ts";

export class FixtureRun {
  public readonly result: ProcessResult;
  public readonly files: readonly string[];

  public constructor(result: ProcessResult, files: readonly string[]) {
    this.result = result;
    this.files = files;
  }
}
