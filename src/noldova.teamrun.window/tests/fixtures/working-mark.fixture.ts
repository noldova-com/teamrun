/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WorkingMark {
  public readonly name: string;
  public readonly instance: string | undefined;

  public constructor(name: string, instance: string | undefined) {
    this.name = name;
    this.instance = instance;
  }
}
