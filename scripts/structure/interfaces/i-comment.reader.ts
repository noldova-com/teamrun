/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default interface ICommentReader {
  readonly header: string;

  readCommentLines(text: string): readonly number[];
}
