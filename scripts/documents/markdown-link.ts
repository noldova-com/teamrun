/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class MarkdownLink {
  public readonly target: string;
  public readonly line: number;

  public constructor(target: string, line: number) {
    this.target = target;
    this.line = line;
  }
}
