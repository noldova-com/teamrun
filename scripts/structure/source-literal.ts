/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class SourceLiteral {
  public readonly value: string;
  public readonly line: number;

  public constructor(value: string, line: number) {
    this.value = value;
    this.line = line;
  }
}
