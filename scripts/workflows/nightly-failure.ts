/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class NightlyFailure {
  public readonly name: string;
  public readonly message: string;
  public readonly count: number;

  public constructor(name: string, message: string, count: number) {
    this.name = name;
    this.message = message;
    this.count = count;
  }
}
