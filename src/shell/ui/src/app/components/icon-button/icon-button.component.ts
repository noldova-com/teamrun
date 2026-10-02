/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "button[tr-icon-button]",
  templateUrl: "./icon-button.component.html",
  styleUrl: "./icon-button.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-icon-button",
    "[attr.aria-label]": "label()",
    "[attr.aria-pressed]": "pressed() ?? null"
  }
})
export class IconButtonComponent {
  public readonly icon = input.required<string>();
  public readonly label = input.required<string>();
  public readonly pressed = input<boolean>();
}
