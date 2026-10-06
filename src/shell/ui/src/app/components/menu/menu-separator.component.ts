/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "tr-menu-separator",
  templateUrl: "./menu-separator.component.html",
  styleUrl: "./menu-separator.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "role": "separator"
  }
})
export class MenuSeparatorComponent {}
