/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ICoverageRange {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly count: number;
}
