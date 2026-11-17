/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CmdletParameters {
  public readonly switches: readonly string[];
  public readonly values: readonly string[];

  public constructor(switches: readonly string[], values: readonly string[]) {
    this.switches = switches;
    this.values = values;
  }
}
