/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AcpRoutedCall {
  public readonly name: string | null;
  public readonly shown: string;

  public constructor(name: string | null, shown: string) {
    this.name = name;
    this.shown = shown;
  }
}
