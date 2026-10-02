/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, BlockCoverage, CoverageReportWriter, CoverageResult, FileCoverage, LineRange, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class CoverageReportWriterTests {
  @TestMethod
  public framesTheTableWithBorders(): void {
    const lines = this.format([new FileCoverage("Sample.Core", "api/index.ts", [], 200, 0, [new BlockCoverage(1, true)])]);

    Assert.isTrue(lines[0]?.startsWith("┌") ?? false);
    Assert.isTrue(lines[lines.length - 1]?.startsWith("└") ?? false);
    Assert.isTrue(lines.some(t => t.includes("File") && t.includes("Coverage") && t.includes("Blocks")));
  }

  @TestMethod
  public usesExplicitProjectIdentity(): void {
    const lines = this.format([
      new FileCoverage("Sample.Parsers.Regex", "nodes/regex-node.ts", [], 200, 0, []),
      new FileCoverage("Sample.NativeCompiler", "compiler.ts", [], 200, 0, [])
    ]);

    Assert.areEqual(1, lines.filter(t => t.includes(" Sample.Parsers.Regex ")).length);
    Assert.areEqual(1, lines.filter(t => t.includes(" Sample.NativeCompiler ")).length);
    Assert.isTrue(lines.some(t => t.includes("  nodes/regex-node.ts")));
    Assert.isTrue(lines.some(t => t.includes("  compiler.ts")));
  }

  @TestMethod
  public listsUncoveredLinesInRedBeneathTheFile(): void {
    const lines = this.format([new FileCoverage(
      "Sample.Core",
      "api/index.ts",
      [new LineRange(3, 5)],
      200,
      50,
      [new BlockCoverage(1, true), new BlockCoverage(3, false)])]);

    Assert.isTrue(lines.some(t => t.includes("75.0%") && t.includes("1/2")));
    Assert.isTrue(lines.some(t => t.includes("uncovered lines 3-5") && t.includes("\u001b[31m")));
  }

  @TestMethod
  public showsANonExecutableFileAsNotApplicable(): void {
    const lines = this.format([new FileCoverage("Sample.Core", "api/index.ts", [], 0, 0, [])]);
    const fileLine = lines.find(t => t.includes("api/index.ts"));

    Assert.isDefined(fileLine);
    Assert.areEqual(2, fileLine.match(/-/gu)?.length);
    Assert.isFalse(fileLine.includes("100.0%"));
    Assert.isFalse(fileLine.includes("0/0"));
    const overallLine = lines.find(t => t.includes("Overall — 0 of 0 executable files fully covered"));
    Assert.isDefined(overallLine);
    Assert.areEqual(2, overallLine.match(/-/gu)?.length);
  }

  @TestMethod
  public summarizesTheOverallCoverage(): void {
    const lines = this.format([
      new FileCoverage("Sample.Core", "a.ts", [], 100, 0, [new BlockCoverage(1, true), new BlockCoverage(2, true)]),
      new FileCoverage("Sample.Core", "b.ts", [new LineRange(1, 1)], 100, 50, [new BlockCoverage(1, false)])
    ]);

    Assert.isTrue(lines.some(t => t.includes("Overall — 1 of 2 executable files fully covered") && t.includes("75.0%") && t.includes("2/3")));
  }

  @TestMethod
  public skipsCoveredDetailsOnRequest(): void {
    const lines = new CoverageReportWriter().formatLines(new CoverageResult([
      new FileCoverage("Sample.Core", "covered.ts", [], 100, 0, [new BlockCoverage(1, true)]),
      new FileCoverage("Sample.Testing", "partial.ts", [new LineRange(2, 2)], 100, 30, [])
    ]), true);

    Assert.isTrue(lines.every(t => !t.includes("covered.ts")));
    Assert.isTrue(lines.every(t => !t.includes(" Sample.Core ")));
    Assert.isTrue(lines.some(t => t.includes("partial.ts") && t.includes("70.0%")));
    Assert.isTrue(lines.some(t => t.includes("uncovered lines 2")));
    Assert.isTrue(lines.some(t => t.includes("Overall — 1 of 2 executable files fully covered")));
  }

  @TestMethod
  public showsOnlyTheOverallRowWhenEverythingIsCoveredAndDetailsAreSkipped(): void {
    const lines = new CoverageReportWriter().formatLines(new CoverageResult([
      new FileCoverage("Sample.Core", "covered.ts", [], 100, 0, [])
    ]), true);

    Assert.isTrue(lines.every(t => !t.includes("covered.ts")));
    Assert.isTrue(lines.some(t => t.includes("Overall — 1 of 1 executable files fully covered")));
  }

  @TestMethod
  public showsAnExcludedFileWithItsReasonEvenWhenDetailsAreSkipped(): void {
    const lines = new CoverageReportWriter().formatLines(new CoverageResult([
      new FileCoverage("Sample.Core", "covered.ts", [], 100, 0, []),
      new FileCoverage("Sample.Core", "main.ts", [new LineRange(1, 5)], 50, 50, [], "Runs only inside Electron.")
    ]), true);

    Assert.isTrue(lines.some(t => t.includes("main.ts") && t.includes("0.0%")));
    Assert.isTrue(lines.some(t => t.includes("excluded: Runs only inside Electron.")));
    Assert.isTrue(lines.every(t => !t.includes("uncovered lines")));
    Assert.isTrue(lines.some(t => t.includes("Overall — 1 of 2 executable files fully covered, 1 excluded")));
  }

  private format(fileCoverages: readonly FileCoverage[]): string[] {
    return new CoverageReportWriter().formatLines(new CoverageResult(fileCoverages), false);
  }
}
