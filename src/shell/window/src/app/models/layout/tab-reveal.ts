/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Tab } from "./tab";

export class TabReveal {
  public readonly tab: Tab;
  public readonly sequence: number;

  public constructor(tab: Tab, sequence: number) {
    this.tab = tab;
    this.sequence = sequence;
  }
}
