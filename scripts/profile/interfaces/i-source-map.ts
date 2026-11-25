/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ISourceMap {
  originalPositionFor(position: { line: number; column: number }): { source: string | null; line: number | null; name: string | null };
}

export interface ISourceMapModule {
  SourceMapConsumer: new (map: unknown) => ISourceMap;
}
