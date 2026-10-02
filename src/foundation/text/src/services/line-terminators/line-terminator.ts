/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export abstract class LineTerminator {
  public abstract getLength(value: string, index: number): 0 | 1 | 2;
  public abstract isLineTerminator(character: string): boolean;
}
