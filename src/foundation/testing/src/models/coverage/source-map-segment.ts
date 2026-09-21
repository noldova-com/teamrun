/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SourceMapSegment {
  public readonly generatedColumn: number;
  public readonly sourcePath: string | undefined;
  public readonly sourceLine: number | undefined;

  public constructor(generatedColumn: number, sourcePath?: string, sourceLine?: number) {
    this.generatedColumn = generatedColumn;
    this.sourcePath = sourcePath;
    this.sourceLine = sourceLine;
  }
}
