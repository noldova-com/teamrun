/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import GalleryFile from "../../angular/gallery-file.ts";
import ProcessRunnerFixture from "./process-runner.fixture.ts";

export default class AngularReportRunnerFixture extends ProcessRunnerFixture {
  private static readonly OUTPUT_FILE_OPTION: string = "--output-file";
  private static readonly PACKAGED_OPTION: string = "--packaged";
  private static readonly OUTPUT_OPTION: string = "--output";

  private static readonly REPORTER_DESTINATION: string = "--test-reporter-destination=";

  private readonly report: string;
  private readonly tapReport: string;

  public constructor(report: string, exitCodes: readonly (number | null)[] = [], tapReport: string = "# tests 0\n") {
    super(exitCodes);

    this.report = report;
    this.tapReport = tapReport;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const file = commandArguments[commandArguments.indexOf(AngularReportRunnerFixture.OUTPUT_FILE_OPTION) + 1];
    if (commandArguments.includes(AngularReportRunnerFixture.OUTPUT_FILE_OPTION) && file !== undefined)
      await writeFile(file, this.report);
    const destination = commandArguments.find(t => t.startsWith(AngularReportRunnerFixture.REPORTER_DESTINATION) && !t.endsWith("=stdout"));
    if (destination !== undefined)
      await writeFile(destination.slice(AngularReportRunnerFixture.REPORTER_DESTINATION.length), this.tapReport);
    if (commandArguments.includes(AngularReportRunnerFixture.PACKAGED_OPTION)) {
      await new GalleryFile(directory).writeAsync(true);
      const output = commandArguments[commandArguments.indexOf(AngularReportRunnerFixture.OUTPUT_OPTION) + 1];
      if (output !== undefined) {
        await mkdir(path.join(output, "window"), { recursive: true });
        await writeFile(path.join(output, "window", "main.js"), "export {};\n");
      }
    }
    return super.runAsync(command, commandArguments, directory, environment);
  }
}
