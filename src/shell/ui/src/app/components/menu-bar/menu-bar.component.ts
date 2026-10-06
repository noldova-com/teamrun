/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkMenuBar } from "@angular/cdk/menu";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "tr-menu-bar",
  templateUrl: "./menu-bar.component.html",
  styleUrl: "./menu-bar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [CdkMenuBar],
  host: {
    "[attr.aria-label]": "label()"
  }
})
export class MenuBarComponent {
  public readonly label = input<string | null>(null);
}
