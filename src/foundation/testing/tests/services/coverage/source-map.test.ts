/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, SourceMap, TestClass, TestingException, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class SourceMapTests {
  @TestMethod
  public mapsAOneToOneShiftedFile(): void {
    const mapDirectory = resolve("maps");
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAKA;AACA;AACA" }, mapDirectory);

    Assert.areEqual<number | undefined>(6, sourceMap.mapToSource(1, 0)?.line);
    Assert.areEqual<number | undefined>(7, sourceMap.mapToSource(2, 0)?.line);
    Assert.areEqual<number | undefined>(8, sourceMap.mapToSource(3, 5)?.line);
    Assert.areEqual<string | undefined>(resolve(mapDirectory, "sample.ts").replaceAll("\\", "/"), sourceMap.mapToSource(1, 0)?.sourcePath);
  }

  @TestMethod
  public usesTheNearestPrecedingSegmentWithinALine(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AACA,CADA" }, "D:/maps");

    Assert.areEqual<number | undefined>(2, sourceMap.mapToSource(1, 0)?.line);
    Assert.areEqual<number | undefined>(1, sourceMap.mapToSource(1, 9)?.line);
  }

  @TestMethod
  public returnsUndefinedForAnUnmappedLine(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAA;;AACA" }, "D:/maps");

    Assert.isUndefined(sourceMap.mapToSource(2, 4));
  }

  @TestMethod
  public returnsUndefinedBeforeTheFirstMapping(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: ";AAAA" }, "D:/maps");

    Assert.isUndefined(sourceMap.mapToSource(1, 0));
  }

  @TestMethod
  public rejectsAnInvalidMappingCharacter(): void {
    Assert.throws(() => {
      new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AA!A" }, "D:/maps");
    }, TestingException);
  }

  @TestMethod
  public decodesMultiDigitValues(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAgCA" }, "D:/maps");

    Assert.areEqual<number | undefined>(33, sourceMap.mapToSource(1, 0)?.line);
  }

  @TestMethod
  public treatsAColumnOnlySegmentAsUnmapped(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAA;C" }, "D:/maps");

    Assert.isUndefined(sourceMap.mapToSource(2, 5));
  }

  @TestMethod
  public rejectsATwoValueSegment(): void {
    Assert.throws(() => {
      new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AACA,AA" }, "D:/maps");
    }, TestingException);
  }

  @TestMethod
  public rejectsATruncatedSegment(): void {
    Assert.throws(() => {
      new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "g" }, "D:/maps");
    }, TestingException);
  }

  @TestMethod
  public rejectsAnUnsupportedVersion(): void {
    Assert.throws(() => {
      new SourceMap({ version: 2, sources: ["sample.ts"], mappings: "AAAA" }, "D:/maps");
    }, TestingException);
  }

  @TestMethod
  public rejectsAnEmptyMapDirectory(): void {
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAA" }, " "), ArgumentException);
  }

  @TestMethod
  public rejectsInvalidGeneratedPositions(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAA" }, "D:/maps");

    Assert.throws(() => sourceMap.mapToSource(0, 0), ArgumentOutOfRangeException);
    Assert.throws(() => sourceMap.mapToSource(1, -1), ArgumentOutOfRangeException);
  }

  @TestMethod
  public returnsUndefinedBeyondTheMappedLines(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAA" }, "D:/maps");

    Assert.isUndefined(sourceMap.mapToSource(2, 0));
  }

  @TestMethod
  public rejectsNegativeGeneratedColumns(): void {
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "D" }, "D:/maps"), TestingException);
  }

  @TestMethod
  public rejectsInvalidOriginalPositions(): void {
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "ACAA" }, "D:/maps"), TestingException);
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AADA" }, "D:/maps"), TestingException);
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAD" }, "D:/maps"), TestingException);
  }

  @TestMethod
  public rejectsANegativeNameIndex(): void {
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAAD" }, "D:/maps"), TestingException);
  }

  @TestMethod
  public rejectsANameIndexOutsideTheNameTable(): void {
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAAA" }, "D:/maps"), TestingException);
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAAC", names: ["name"] }, "D:/maps"), TestingException);
  }

  @TestMethod
  public acceptsANameIndexInsideTheNameTable(): void {
    const sourceMap = new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "AAAAA", names: ["name"] }, "D:/maps");

    Assert.areEqual<number | undefined>(1, sourceMap.mapToSource(1, 0)?.line);
  }

  @TestMethod
  public rejectsSegmentsOutsideGeneratedColumnOrder(): void {
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "C,D" }, "D:/maps"), TestingException);
  }

  @TestMethod
  public rejectsAnUnsafeMappingInteger(): void {
    Assert.throws(() => new SourceMap({ version: 3, sources: ["sample.ts"], mappings: "///////////A" }, "D:/maps"), TestingException);
  }

}
