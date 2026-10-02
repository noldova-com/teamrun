/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class SourceMapSegment {
  public readonly generatedColumn: number;
  public readonly sourcePath?: string;
  public readonly sourceLine?: number;

  public constructor(generatedColumn: number, sourcePath?: string, sourceLine?: number) {
    this.generatedColumn = generatedColumn;
    if (!Object.isUndefined(sourcePath))
      this.sourcePath = sourcePath;
    if (!Object.isUndefined(sourceLine))
      this.sourceLine = sourceLine;
  }
}
