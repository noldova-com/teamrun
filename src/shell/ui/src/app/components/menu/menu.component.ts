/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkMenu, CdkTargetMenuAim } from "@angular/cdk/menu";
import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "tr-menu",
  templateUrl: "./menu.component.html",
  styleUrl: "./menu.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkMenu, CdkTargetMenuAim],
  host: {
    "class": "tr-scroll-reveal"
  }
})
export class MenuComponent {}
