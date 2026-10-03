/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";

import ProcessRunnerFixture from "./process-runner.fixture.ts";

export default class AngularReportRunnerFixture extends ProcessRunnerFixture {
  private static readonly OUTPUT_FILE_OPTION: string = "--output-file";

  private readonly report: string;

  public constructor(report: string, exitCodes: readonly (number | null)[] = []) {
    super(exitCodes);

    this.report = report;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const file = commandArguments[commandArguments.indexOf(AngularReportRunnerFixture.OUTPUT_FILE_OPTION) + 1];
    if (commandArguments.includes(AngularReportRunnerFixture.OUTPUT_FILE_OPTION) && file !== undefined)
      await writeFile(file, this.report);
    return super.runAsync(command, commandArguments, directory, environment);
  }
}
