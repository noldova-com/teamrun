/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ISourceMapData {
  readonly version: number;
  readonly sources: readonly string[];
  readonly mappings: string;
  readonly sourceRoot?: string;
  readonly names?: readonly string[];
}
