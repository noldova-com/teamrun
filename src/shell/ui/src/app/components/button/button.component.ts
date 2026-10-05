/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import { ButtonVariant } from "../../enums/button-variant";

@Component({
  selector: "button[tr-button]",
  templateUrl: "./button.component.html",
  styleUrl: "./button.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-button",
    "[class.tr-button-secondary]": "isSecondary()"
  }
})
export class ButtonComponent {
  protected readonly isSecondary: Signal<boolean> = computed(() => this.variant() === ButtonVariant.Secondary);

  public readonly variant = input<ButtonVariant>(ButtonVariant.Primary);
}
