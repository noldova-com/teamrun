/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rectangle } from "electron";

import type { IDisplayHost } from "@noldova/teamrun-shell-desktop";

export class FakeDisplayHost implements IDisplayHost {
  public workAreas: Rectangle[] = [{ x: 0, y: 0, width: 1920, height: 1040 }];

  public getAllDisplays(): readonly { readonly workArea: Rectangle }[] {
    return this.workAreas.map(t => ({ workArea: t }));
  }
}
