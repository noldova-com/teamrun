/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "tr-tooltip",
  templateUrl: "./tooltip.component.html",
  styleUrl: "./tooltip.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-tooltip",
    "role": "tooltip"
  }
})
export class TooltipComponent {
  public readonly text = input.required<string>();
}
