/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestingException } from "../../exceptions/testing.exception.js";
import type { ITestProgressListener } from "../../interfaces/i-test-progress-listener.js";
import { DiscoveredTestClass } from "../../models/discovery/discovered-test-class.js";
import type { TestProject } from "../../models/discovery/test-project.js";
import { TestRunResult } from "../../models/results/test-run-result.js";
import { Resources } from "../../resources.js";
import type { TestDiscovery } from "../discovery/test-discovery.js";
import type { TestExecutor } from "./test-executor.js";

export class TestRunner {
  private readonly discovery: TestDiscovery;
  private readonly executor: TestExecutor;

  public constructor(discovery: TestDiscovery, executor: TestExecutor) {
    this.discovery = discovery;
    this.executor = executor;
  }

  public async runAsync(testProjects: readonly TestProject[], filters: readonly string[] = [], progress?: ITestProgressListener): Promise<TestRunResult> {
    const discovered = await this.discovery.discoverAsync(testProjects);
    const selected = this.applyFilters(discovered, filters);
    const classResults = await this.executor.executeAsync(selected, progress);
    const result = new TestRunResult(classResults);

    const selectedCount = selected.reduce((count, testClass) => count + testClass.methods.length, 0);
    if (result.total !== selectedCount)
      throw new TestingException(Resources.runResultCountMismatch(result.total, selectedCount));

    return result;
  }

  private applyFilters(testClasses: readonly DiscoveredTestClass[], filters: readonly string[]): DiscoveredTestClass[] {
    if (filters.length === 0)
      return [...testClasses];

    const categoryFilters = new Set(filters.filter(t => t.startsWith(Resources.categoryFilterPrefix)).map(t => t.slice(Resources.categoryFilterPrefix.length)));
    const identityFilters = filters.filter(t => !t.startsWith(Resources.categoryFilterPrefix));
    const selected: DiscoveredTestClass[] = [];
    for (const testClass of testClasses) {
      if (testClass.categories.some(t =>
        categoryFilters.has(t)) ||
        identityFilters.some(t => testClass.packageName.includes(t) || testClass.filePath.includes(t) || testClass.className.includes(t))) {
        selected.push(testClass);
        continue;
      }

      const matchingMethods = testClass.methods.filter(t => {
        const methodIdentity = `${testClass.className}.${t.displayName}`;
        return t.categories.some(t => categoryFilters.has(t)) || identityFilters.some(t => methodIdentity.includes(t));
      });

      if (matchingMethods.length > 0)
        selected.push(new DiscoveredTestClass(
          testClass.packageName,
          testClass.className,
          testClass.filePath,
          testClass.testClassConstructor,
          testClass.skipReason,
          matchingMethods,
          testClass.categories));
    }

    return selected;
  }
}
