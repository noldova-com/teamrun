/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ControlPartCase {
  public readonly name: string;
  public readonly open: () => Promise<void>;
  public readonly iconOnly: readonly string[] | undefined;

  public constructor(name: string, open: () => Promise<void>, iconOnly?: readonly string[]) {
    this.name = name;
    this.open = open;
    this.iconOnly = iconOnly;
  }
}
