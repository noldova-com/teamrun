/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDockHost } from "@noldova/teamrun-shell-desktop";

export class FakeDockHost implements IDockHost {
  public readonly icons: string[] = [];

  public setIcon(iconPath: string): void {
    this.icons.push(iconPath);
  }
}
