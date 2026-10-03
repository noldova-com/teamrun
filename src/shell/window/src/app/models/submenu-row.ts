/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MenuRow } from "./menu-row";

export class SubmenuRow extends MenuRow {
  public readonly isSubmenu: true = true;
  public readonly place: string;

  public constructor(place: string, title: string) {
    super(title, null);

    this.place = place;
  }
}
