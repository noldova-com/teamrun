/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SelectOption {
  public readonly value: string;
  public readonly title: string;

  public constructor(value: string, title: string) {
    this.value = value;
    this.title = title;
  }
}
