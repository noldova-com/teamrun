/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ViewDockMark {
  public readonly name: string;
  public readonly instance: string | null;

  public constructor(name: string, instance: string | null) {
    this.name = name;
    this.instance = instance;
  }
}
