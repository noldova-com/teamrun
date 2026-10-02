/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, CoverageExclusion, CoverageProject, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class CoverageProjectTests {
  @TestMethod
  public storesTheExplicitIdentityAndDirectories(): void {
    const project = new CoverageProject("Sample", "production", "source");

    Assert.areEqual("Sample", project.name);
    Assert.areEqual("production", project.productionDirectory);
    Assert.areEqual("source", project.sourceDirectory);
    Assert.areEqual(0, project.exclusions.length);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheExclusions(): void {
    const exclusions = [new CoverageExclusion("main.ts", "Runs only inside Electron.")];

    const project = new CoverageProject("Sample", "production", "source", exclusions);
    exclusions.pop();

    Assert.areEqual("main.ts", project.exclusions[0]?.relativePath);
  }

  @TestMethod
  public rejectsAFileExcludedTwice(): void {
    const exclusion = new CoverageExclusion("main.ts", "Runs only inside Electron.");

    Assert.throws(() => new CoverageProject("Sample", "production", "source", [exclusion, exclusion]), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceName(): void {
    Assert.throws(() => new CoverageProject(" ", "production", "source"), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceProductionDirectory(): void {
    Assert.throws(() => new CoverageProject("Sample", " ", "source"), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceSourceDirectory(): void {
    Assert.throws(() => new CoverageProject("Sample", "production", " "), ArgumentException);
  }
}
