/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IContextMenuParams {
  readonly x: number;
  readonly y: number;
  readonly misspelledWord: string;
  readonly dictionarySuggestions: string[];
  readonly menuSourceType: string;
}
