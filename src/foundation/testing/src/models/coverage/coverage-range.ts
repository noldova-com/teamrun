/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CoverageRange {
  public readonly startOffset: number;
  public readonly endOffset: number;
  public readonly count: number;

  public constructor(startOffset: number, endOffset: number, count: number) {
    this.startOffset = startOffset;
    this.endOffset = endOffset;
    this.count = count;
  }
}
