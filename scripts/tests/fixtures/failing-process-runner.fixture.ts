/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ProcessRunner from "../../processes/process-runner.ts";
import ProcessException from "../../processes/process.exception.ts";

export default class FailingProcessRunnerFixture extends ProcessRunner {
  public override async runAsync(command: string): Promise<number | null> {
    throw new ProcessException(`"${command}" could not start.`);
  }
}
