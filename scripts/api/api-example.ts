/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class ApiExample {
  private static readonly UNSAFE_CHARACTERS: RegExp = /[^A-Za-z0-9]+/g;
  private static readonly SEPARATOR: string = "-";

  public readonly owner: string;
  public readonly index: number;
  public readonly code: string;

  public constructor(owner: string, index: number, code: string) {
    this.owner = owner;
    this.index = index;
    this.code = code;
  }

  public get fileName(): string {
    return `${this.owner.replace(ApiExample.UNSAFE_CHARACTERS, ApiExample.SEPARATOR)}${ApiExample.SEPARATOR}${this.index}.ts`;
  }

  public get title(): string {
    return `${this.owner} example ${this.index}`;
  }
}
