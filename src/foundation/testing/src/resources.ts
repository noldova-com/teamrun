/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly standardErrorDescriptor: number = 2;
  public static readonly failedExitCode: number = 1;
  public static readonly defaultTimeoutMilliseconds: number = 30_000;
  public static readonly testShutdownGraceMilliseconds: number = 1000;
  public static readonly gitHubSummaryVariable: string = "GITHUB_STEP_SUMMARY";
  public static readonly filtersVariable: string = "TEAMRUN_TEST_FILTERS";
  public static readonly skipTestDetailsVariable: string = "TEAMRUN_SKIP_TEST_DETAILS";
  public static readonly timeoutVariable: string = "TEAMRUN_TEST_TIMEOUT_MILLISECONDS";
  public static readonly temporaryRootVariable: string = "TEAMRUN_TEMPORARY_ROOT";
  public static readonly temporaryDirectoryPrefix: string = "teamrun-test-run-";
  public static readonly temporaryDirectoryVariables: readonly string[] = ["TMPDIR", "TEMP", "TMP"];
  public static readonly temporaryRemovalRetries: number = 5;
  public static readonly summaryDetailLimit: number = 20_000;
  public static readonly summaryEncoding: BufferEncoding = "utf8";
  public static readonly summaryNewline: string = "\n";
  public static readonly summaryTestHeading: string = "## TeamRun Package Test Report";
  public static readonly summaryFailureHeading: string = "### Package test execution failed";
  public static readonly summaryTableHeading: string = "| Metric | Result |";
  public static readonly summaryTableSeparator: string = "| --- | ---: |";
  public static readonly summaryFilesLabel: string = "Test files";
  public static readonly summaryWriteFailed: string = "Could not write the GitHub job summary; see the console report.";

  public static readonly assertionFailed: string = "Assertion failed.";
  public static readonly expectedTrue: string = "Expected the condition to be true.";
  public static readonly expectedFalse: string = "Expected the condition to be false.";
  public static readonly expectedEqual: string = "Expected the values to be equal.";
  public static readonly expectedNotEqual: string = "Expected the values to be different.";
  public static readonly expectedNull: string = "Expected the value to be null.";
  public static readonly expectedNotNull: string = "Expected the value not to be null.";
  public static readonly expectedUndefined: string = "Expected the value to be undefined.";
  public static readonly expectedDefined: string = "Expected the value to be defined.";
  public static readonly expectedInstanceOf: string = "Expected the value to be an instance of the specified type.";
  public static readonly expectedThrow: string = "Expected the action to throw.";
  public static readonly expectedThrowType: string = "Expected the action to throw the specified exception type.";
  public static readonly expectedNoThrow: string = "Expected the action not to throw.";
  public static readonly testTimedOut: string = "The test did not settle within the allotted timeout.";
  public static readonly runInterrupted: string = "A test exceeded its time limit; the run ended after reporting it, and the tests after it did not run.\n";
  public static readonly durationInvalid: string = "The duration must be a non-negative finite number of milliseconds.";
  public static readonly methodResultIdentityInvalid: string = "Every method result must belong to this package and class.";
  public static readonly timeoutInvalid: string = "The timeout must be a positive integer of milliseconds.";
  public static readonly testProjectPairRequired: string = "Each test project requires a package name and a root directory.";
  public static readonly testFiltersInvalid: string = "The test filters must be a JSON array of strings.";
  public static readonly categoryFilterPrefix: string = "category:";
  public static readonly categoryMarkInvalid: string = "A category mark must carry a non-empty collection of non-whitespace string names.";
  public static readonly skipReasonInvalid: string = "A skip mark must carry a non-whitespace string reason.";
  public static readonly testDataMarkInvalid: string = "A test-data mark must carry a non-empty collection of test-data entries.";
  public static readonly testDataIdentityInvalid: string = "Test data and its index must either both be present or both be absent.";
  public static readonly testDataIndexInvalid: string = "The test-data index must be a non-negative integer.";
  public static readonly directorySeparator: string = "/";
  public static readonly windowsDirectorySeparator: string = "\\";
  public static readonly testReportSeparator: string = "----------------------------------------";
  public static readonly totalLabel: string = "Total:";
  public static readonly timeLabel: string = "Time:";
  public static readonly passedLabel: string = "Passed:";
  public static readonly failedLabel: string = "Failed:";
  public static readonly skippedLabel: string = "Skipped:";
  public static readonly unreachedLabel: string = "Unreached:";
  public static readonly passedMark: string = "✓";
  public static readonly failedMark: string = "✘";
  public static readonly skippedMark: string = "○";
  public static readonly unreachedMark: string = "-";
  public static readonly millisecondUnit: string = "ms";
  public static readonly expectedLabel: string = "expected:";
  public static readonly actualLabel: string = "actual:";
  public static readonly threwLabel: string = "threw:";
  public static readonly notRunLabel: string = "not run";

  public static formatOutcomeCannotCarryFailure(outcome: string): string {
    return `A ${outcome} result cannot carry a failure.`;
  }

  public static formatOutcomeCannotCarrySkipReason(outcome: string): string {
    return `A ${outcome} result cannot carry a skip reason.`;
  }

  public static formatRunResultCountMismatch(resultCount: number, selectedCount: number): string {
    return `The run produced ${resultCount} results for ${selectedCount} selected tests.`;
  }

  public static formatMethodNotCallable(methodName: string, className: string): string {
    return `Method "${methodName}" of "${className}" is not callable.`;
  }

  public static formatUnmarkedNamedTestClass(exportName: string, filePath: string): string {
    return `Export "${exportName}" in "${filePath}" is named like a test class but is not marked with @TestClass.`;
  }

  public static formatMarkedTestClassWithoutRequiredName(exportName: string, filePath: string, requiredSuffix: string): string {
    return `Export "${exportName}" in "${filePath}" is marked with @TestClass but its name does not end in "${requiredSuffix}".`;
  }

  public static formatTestFileWithoutTestClass(filePath: string): string {
    return `Test file "${filePath}" yields no test class. Skip a suite deliberately with @Skip("reason"); delete the file when it is no longer needed.`;
  }

  public static formatTestClassWithoutPrototype(className: string, filePath: string): string {
    return `Test class "${className}" in "${filePath}" has no prototype.`;
  }

  public static formatCategoryWithoutTestClass(exportName: string, filePath: string): string {
    return `Export "${exportName}" in "${filePath}" carries @Category but is not marked with @TestClass.`;
  }

  public static formatStaticTestMetadataInvalid(memberName: string, className: string, filePath: string): string {
    return `Static method "${memberName}" of "${className}" in "${filePath}" cannot carry test metadata; mark instance methods only.`;
  }

  public static formatAccessorTestMetadataInvalid(memberName: string, className: string, filePath: string): string {
    return `Accessor "${memberName}" of "${className}" in "${filePath}" cannot carry test metadata; mark instance methods only.`;
  }

  public static formatTestClassWithoutTestMethod(className: string, filePath: string): string {
    return `Test class "${className}" in "${filePath}" declares no test method.`;
  }

  public static formatTestDataWithoutTestMethod(memberName: string, className: string, filePath: string): string {
    return `Method "${memberName}" of "${className}" in "${filePath}" carries @TestData but is not marked with @TestMethod.`;
  }

  public static formatCategoryWithoutTestMethod(memberName: string, className: string, filePath: string): string {
    return `Method "${memberName}" of "${className}" in "${filePath}" carries @Category but is not marked with @TestMethod.`;
  }

  public static formatTestMethodRequiresData(memberName: string, className: string, filePath: string): string {
    return `Test method "${memberName}" of "${className}" in "${filePath}" declares parameters but carries no @TestData.`;
  }

  public static formatTestDataParameterCountMismatch(memberName: string, className: string, filePath: string, expectedCount: number, actualCount: number): string {
    return `Test data for "${memberName}" of "${className}" in "${filePath}" supplies ${actualCount} values for ${expectedCount} parameters.`;
  }

  public static formatSkippedTest(methodName: string, reason: string | undefined): string {
    return `${methodName} — skipped: ${reason}`;
  }

  public static formatUnreachedTest(methodName: string): string {
    return `${methodName} — ${Resources.notRunLabel}`;
  }

  public static formatUnclosedTestResources(resources: readonly string[]): string {
    if (resources.length === 0)
      return `Tests finished but the process did not exit within ${Resources.testShutdownGraceMilliseconds} ms and Node names no open resource; ` +
        "a worker thread or a native handle keeps it alive. Failing the run.\n";

    return `Tests finished but resources remain open: ${resources.join(", ")}. Failing the run.\n`;
  }

  public static formatTemporaryLeftovers(leftovers: readonly string[]): string {
    return `Tests finished but left ${leftovers.join(", ")} in the run's temporary folder; a test must remove what it creates. Failing the run.\n`;
  }

  public static formatSummaryRow(label: string, value: string | number): string {
    return `| ${label} | ${value} |`;
  }

  public static formatSummarySeconds(milliseconds: number): string {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }

  public static formatSummaryDetails(escaped: string, truncated: boolean): string {
    return `\n<details><summary>Details (full output in the step log)</summary>\n\n<pre>${escaped}</pre>\n${truncated ? "\nAdditional output omitted.\n" : ""}\n</details>\n`;
  }
}
