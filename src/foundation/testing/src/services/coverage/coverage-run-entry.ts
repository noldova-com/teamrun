/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { TestingException } from "../../exceptions/testing.exception.js";
import { CoverageProject } from "../../models/coverage/coverage-project.js";
import { Resources } from "../../resources.js";
import { CoverageReportWriter } from "../reporting/coverage-report-writer.js";
import { GitHubSummaryWriter } from "../reporting/git-hub-summary-writer.js";
import { CoverageAnalyzer } from "./coverage-analyzer.js";

export class CoverageRunEntry {
  public async runAsync(): Promise<void> {
    const [coverageDirectory, ...projectArguments] = process.argv.slice(2);
    const summary = new GitHubSummaryWriter(process.env[Resources.gitHubSummaryVariable]);

    try {
      if (Object.isUndefined(coverageDirectory))
        throw new TestingException(Resources.coverageDirectoryRequired);

      const projects: CoverageProject[] = [];
      for (let index = 0; index < projectArguments.length; index += 3) {
        const name = projectArguments[index];
        const productionDirectory = projectArguments[index + 1];
        const sourceDirectory = projectArguments[index + 2];
        if (Object.isUndefined(name) || Object.isUndefined(productionDirectory) || Object.isUndefined(sourceDirectory))
          throw new TestingException(Resources.coverageProjectTripleRequired);

        projects.push(new CoverageProject(name, productionDirectory, sourceDirectory));
      }

      const result = await new CoverageAnalyzer().analyzeAsync(coverageDirectory, projects);
      for (const line of new CoverageReportWriter().formatLines(result, !Object.isUndefined(process.env[Resources.skipTestDetailsVariable])))
        console.log(line);
      summary.writeCoverage(result);
      process.exitCode = result.isComplete ? 0 : Resources.failedExitCode;
    }
    catch (error) {
      console.error(String(error));
      summary.writeFailure(String(error));
      process.exitCode = Resources.failedExitCode;
    }
  }
}

await new CoverageRunEntry().runAsync();
