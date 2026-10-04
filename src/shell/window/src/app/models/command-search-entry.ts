/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { QuickInputItem } from "@noldova/teamrun-shell-ui";

export class CommandSearchEntry {
  public readonly item: QuickInputItem;
  public readonly category: string;
  public readonly run: () => void;

  public constructor(item: QuickInputItem, category: string, run: () => void) {
    this.item = item;
    this.category = category;
    this.run = run;
  }
}
