/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { ITestProgressListener, TestClassResult } from "@noldova/teamrun-foundation-testing";

export class RecordingTestProgress implements ITestProgressListener {
  public readonly events: string[] = [];
  public readonly results: TestClassResult[] = [];
  public completionFailure?: Error;

  public onClassCompleted(result: TestClassResult): void {
    this.events.push("complete:" + result.filePath);
    this.results.push(result);
    if (!Object.isUndefined(this.completionFailure))
      throw this.completionFailure;
  }
}
