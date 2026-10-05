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

import { TestingException } from "../../exceptions/testing.exception.js";
import { CoverageProject } from "../../models/coverage/coverage-project.js";
import { CoverageResult } from "../../models/coverage/coverage-result.js";
import { FileCoverage } from "../../models/coverage/file-coverage.js";
import { Resources } from "../../resources.js";
import { CoverageReportReader } from "./coverage-report.reader.js";
import { FileCoverageAnalyzer } from "./file-coverage-analyzer.js";

export class CoverageAnalyzer {
  private static readonly JAVASCRIPT_FILE_SUFFIX: string = ".js";
  private static readonly DECLARATION_FILE_SUFFIX: string = ".d.ts";

  public async analyzeAsync(coverageDirectory: string, projects: readonly CoverageProject[]): Promise<CoverageResult> {
    ArgumentException.throwIfNullOrWhitespace(coverageDirectory, "coverageDirectory");
    ArgumentException.throwIfEmpty(projects, "projects");

    const normalizedProjects = projects.map(t => {
      const productionDirectory = this.normalizeDirectory(t.productionDirectory);
      return new CoverageProject(
        t.name,
        productionDirectory,
        this.normalizeDirectory(t.sourceDirectory),
        t.exclusions,
        t.testFolders.map(u => this.normalizeDirectory(join(productionDirectory, u))));
    });
    const expectedFilePathsByProject = new Map<CoverageProject, string[]>();
    for (const project of normalizedProjects)
      expectedFilePathsByProject.set(project, (await this.collectExpectedFilePathsAsync(project.productionDirectory)).filter(t => this.isMeasured(t, project)));

    if ([...expectedFilePathsByProject.values()].every(t => t.length === 0))
      throw new TestingException(Resources.coverageUniverseEmpty);

    const scriptEntriesByFile = await new CoverageReportReader(normalizedProjects.map(t => t.productionDirectory)).readAsync(coverageDirectory);
    const fileCoverages: FileCoverage[] = [];
    for (const [project, expectedFilePaths] of expectedFilePathsByProject) {
      const reportedFilePaths = [...scriptEntriesByFile.keys()].filter(t => this.isMeasured(t, project));
      const filePaths = [...new Set([...expectedFilePaths, ...reportedFilePaths])].sort();
      const fileAnalyzer = new FileCoverageAnalyzer(project);
      const projectCoverages: FileCoverage[] = [];
      for (const filePath of filePaths)
        projectCoverages.push(await fileAnalyzer.analyzeAsync(filePath, scriptEntriesByFile.get(filePath) ?? []));
      const unknown = project.exclusions.filter(t => !projectCoverages.some(file => file.relativePath === t.relativePath));
      if (unknown.length > 0)
        throw new TestingException(Resources.formatUnknownCoverageExclusions(project.name, unknown.map(t => t.relativePath)));
      fileCoverages.push(...projectCoverages);
    }

    return new CoverageResult(fileCoverages);
  }

  private async collectExpectedFilePathsAsync(productionDirectory: string): Promise<string[]> {
    const expectedFilePaths: string[] = [];
    const entries = await readdir(productionDirectory, { recursive: true, withFileTypes: true });
    for (const entry of entries)
      if (entry.isFile() && this.isProductionFile(entry.name))
        expectedFilePaths.push(join(entry.parentPath, entry.name).replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator));

    return expectedFilePaths;
  }

  private isProductionFile(name: string): boolean {
    return name.endsWith(CoverageAnalyzer.JAVASCRIPT_FILE_SUFFIX)
      || (name.endsWith(Resources.typeScriptFileSuffix) && !name.endsWith(CoverageAnalyzer.DECLARATION_FILE_SUFFIX));
  }

  private isMeasured(filePath: string, project: CoverageProject): boolean {
    return filePath.startsWith(project.productionDirectory) && !project.testFolders.some(t => filePath.startsWith(t));
  }

  private normalizeDirectory(directory: string): string {
    return `${resolve(directory).replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator)}${Resources.directorySeparator}`;
  }
}
