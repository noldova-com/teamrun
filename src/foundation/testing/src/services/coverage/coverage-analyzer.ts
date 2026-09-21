/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TestingException } from "../../exceptions/testing-exception.js";
import { CoverageProject } from "../../models/coverage/coverage-project.js";
import { CoverageResult } from "../../models/coverage/coverage-result.js";
import { FileCoverage } from "../../models/coverage/file-coverage.js";
import { Resources } from "../../resources.js";
import { CoverageReportReader } from "./coverage-report-reader.js";
import { FileCoverageAnalyzer } from "./file-coverage-analyzer.js";

export class CoverageAnalyzer {
  private static readonly JAVASCRIPT_FILE_SUFFIX: string = ".js";

  public async analyzeAsync(coverageDirectory: string, projects: readonly CoverageProject[]): Promise<CoverageResult> {
    ArgumentException.throwIfNullOrWhitespace(coverageDirectory, "coverageDirectory");
    ArgumentException.throwIfEmpty(projects, "projects");

    const normalizedProjects = projects.map(t => new CoverageProject(
      t.name,
      this.normalizeDirectory(t.productionDirectory),
      this.normalizeDirectory(t.sourceDirectory)));
    const expectedFilePathsByProject = new Map<CoverageProject, string[]>();
    for (const project of normalizedProjects)
      expectedFilePathsByProject.set(project, await this.collectExpectedFilePathsAsync(project.productionDirectory));

    if ([...expectedFilePathsByProject.values()].every(t => t.length === 0))
      throw new TestingException(Resources.coverageUniverseEmpty);

    const scriptEntriesByFile = await new CoverageReportReader(normalizedProjects.map(t => t.productionDirectory)).readAsync(coverageDirectory);
    const fileCoverages: FileCoverage[] = [];
    for (const [project, expectedFilePaths] of expectedFilePathsByProject) {
      const reportedFilePaths = [...scriptEntriesByFile.keys()].filter(t => t.startsWith(project.productionDirectory));
      const filePaths = [...new Set([...expectedFilePaths, ...reportedFilePaths])].sort();
      const fileAnalyzer = new FileCoverageAnalyzer(project);
      for (const filePath of filePaths)
        fileCoverages.push(await fileAnalyzer.analyzeAsync(filePath, scriptEntriesByFile.get(filePath) ?? []));
    }

    return new CoverageResult(fileCoverages);
  }

  private async collectExpectedFilePathsAsync(productionDirectory: string): Promise<string[]> {
    const expectedFilePaths: string[] = [];
    const entries = await readdir(productionDirectory, { recursive: true, withFileTypes: true });
    for (const entry of entries)
      if (entry.isFile() && entry.name.endsWith(CoverageAnalyzer.JAVASCRIPT_FILE_SUFFIX))
        expectedFilePaths.push(join(entry.parentPath, entry.name).replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator));

    return expectedFilePaths;
  }

  private normalizeDirectory(directory: string): string {
    return `${resolve(directory).replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator)}${Resources.directorySeparator}`;
  }
}
