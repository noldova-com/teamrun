/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AcpLocalVariable {
  public readonly name: string;
  public readonly value: string;

  public constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}
