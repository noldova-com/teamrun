/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class InstanceCase {
  public readonly name: string;
  public readonly instance: string;

  public constructor(name: string, instance: string) {
    this.name = name;
    this.instance = instance;
  }
}
