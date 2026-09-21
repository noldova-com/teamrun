/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { TestingException } from "../../exceptions/testing.exception.js";
import type { ISourceMapData } from "../../interfaces/coverage/i-source-map-data.js";
import { SourceMapSegment } from "../../models/coverage/source-map-segment.js";
import { SourcePosition } from "../../models/coverage/source-position.js";
import { Resources } from "../../resources.js";

export class SourceMap {
  private static readonly BASE64_ALPHABET: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  private static readonly CONTINUATION_BIT: number = 32;
  private static readonly GENERATED_LINE_SEPARATOR: string = ";";
  private static readonly SEGMENT_SEPARATOR: string = ",";
  private static readonly VALUE_MASK: number = 31;
  private static readonly SUPPORTED_VERSION: number = 3;

  private readonly sourcePaths: readonly string[];
  private readonly nameCount: number;
  private readonly segmentsByGeneratedLine: readonly (readonly SourceMapSegment[])[];

  public constructor(data: ISourceMapData, mapDirectory: string) {
    ArgumentException.throwIfNullOrWhitespace(mapDirectory, "mapDirectory");
    if (data.version !== SourceMap.SUPPORTED_VERSION)
      throw new TestingException(Resources.sourceMapVersionInvalid(SourceMap.SUPPORTED_VERSION));

    this.sourcePaths = data.sources.map(t => resolve(mapDirectory, data.sourceRoot ?? String.empty, t)
      .replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator));
    this.nameCount = data.names?.length ?? 0;
    this.segmentsByGeneratedLine = this.decodeMappings(data.mappings);
  }

  public mapToSource(generatedLine: number, generatedColumn: number): SourcePosition | undefined {
    if (!Number.isInteger(generatedLine) || generatedLine < 1)
      throw new ArgumentOutOfRangeException("generatedLine", generatedLine, Resources.generatedLineInvalid);

    if (!Number.isInteger(generatedColumn) || generatedColumn < 0)
      throw new ArgumentOutOfRangeException("generatedColumn", generatedColumn, Resources.generatedColumnInvalid);

    const segment = this.findSegment(generatedLine, generatedColumn);
    if (Object.isUndefined(segment?.sourcePath) || Object.isUndefined(segment.sourceLine))
      return undefined;

    return new SourcePosition(segment.sourcePath, segment.sourceLine + 1);
  }

  private findSegment(generatedLine: number, generatedColumn: number): SourceMapSegment | undefined {
    const segments = this.segmentsByGeneratedLine[generatedLine - 1];
    if (Object.isUndefined(segments))
      return undefined;

    let found: SourceMapSegment | undefined;
    for (const segment of segments) {
      if (segment.generatedColumn > generatedColumn)
        break;

      found = segment;
    }

    return found;
  }

  private decodeMappings(mappings: string): SourceMapSegment[][] {
    const segmentsByGeneratedLine: SourceMapSegment[][] = [];
    let sourceIndex = 0;
    let sourceLine = 0;
    let sourceColumn = 0;
    let nameIndex = 0;

    for (const lineText of mappings.split(SourceMap.GENERATED_LINE_SEPARATOR)) {
      const segments: SourceMapSegment[] = [];
      let generatedColumn = 0;
      let previousGeneratedColumn = -1;

      for (const segmentText of lineText.split(SourceMap.SEGMENT_SEPARATOR)) {
        if (segmentText === String.empty)
          continue;

        const values = this.decodeVlqValues(segmentText);
        if (values.length !== 1 && values.length !== 4 && values.length !== 5)
          throw new TestingException(Resources.sourceMapSegmentFieldCountInvalid);

        for (const [fieldIndex, fieldValue] of values.entries()) {
          switch (fieldIndex) {
            case 0:
              generatedColumn += fieldValue;
              break;
            case 1:
              sourceIndex += fieldValue;
              break;
            case 2:
              sourceLine += fieldValue;
              break;
            case 3:
              sourceColumn += fieldValue;
              break;
            case 4:
              nameIndex += fieldValue;
              break;
          }
        }

        if (generatedColumn < 0)
          throw new TestingException(Resources.sourceMapGeneratedColumnInvalid);

        if (generatedColumn < previousGeneratedColumn)
          throw new TestingException(Resources.sourceMapGeneratedColumnOrderInvalid);

        previousGeneratedColumn = generatedColumn;

        if (values.length === 1) {
          segments.push(new SourceMapSegment(generatedColumn));
          continue;
        }

        const sourcePath = this.sourcePaths[sourceIndex];
        if (Object.isUndefined(sourcePath) || sourceLine < 0 || sourceColumn < 0)
          throw new TestingException(Resources.sourceMapOriginalPositionInvalid);

        if (values.length === 5) {
          if (nameIndex < 0 || nameIndex >= this.nameCount)
            throw new TestingException(Resources.sourceMapNameIndexInvalid);
        }

        segments.push(new SourceMapSegment(generatedColumn, sourcePath, sourceLine));
      }

      segmentsByGeneratedLine.push(segments);
    }

    return segmentsByGeneratedLine;
  }

  private decodeVlqValues(segmentText: string): number[] {
    const values: number[] = [];
    let value = 0;
    let multiplier = 1;
    let isContinued = false;

    for (const character of segmentText) {
      const digit = SourceMap.BASE64_ALPHABET.indexOf(character);
      if (digit === -1)
        throw new TestingException(Resources.sourceMapCharacterInvalid(character));

      value += (digit & SourceMap.VALUE_MASK) * multiplier;
      if (!Number.isSafeInteger(value))
        throw new TestingException(Resources.sourceMapIntegerUnsupported);

      isContinued = (digit & SourceMap.CONTINUATION_BIT) !== 0;
      if (isContinued) {
        multiplier *= 32;
        continue;
      }

      const isNegative = value % 2 === 1;
      const magnitude = Math.floor(value / 2);
      values.push(isNegative ? -magnitude : magnitude);
      value = 0;
      multiplier = 1;
    }

    if (isContinued)
      throw new TestingException(Resources.sourceMapMappingTruncated);

    return values;
  }
}
