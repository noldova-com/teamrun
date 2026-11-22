/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GrownViewDock {
  public readonly name: string;
  public readonly instance: string | null;
  public readonly minimum: number;

  public constructor(name: string, instance: string | null, minimum: number) {
    this.name = name;
    this.instance = instance;
    this.minimum = minimum;
  }
}
