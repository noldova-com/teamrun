/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import { Resources } from "../../../resources";
import { RevealDelayDirective } from "./reveal-delay.directive";

@Component({
  selector: "tr-progress",
  templateUrl: "./progress.component.html",
  styleUrl: "./progress.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: RevealDelayDirective, inputs: ["isDelayed"] }],
  host: {
    "role": "progressbar",
    "[attr.aria-label]": "label()",
    "[attr.aria-valuemin]": "minimum",
    "[attr.aria-valuemax]": "maximum",
    "[attr.aria-valuenow]": "fraction()",
    "[class.tr-progress-indeterminate]": "isIndeterminate()",
    "[style.--tr-progress-fraction]": "fraction()"
  }
})
export class ProgressComponent {
  public readonly minimum: number = Resources.progressMinimum;
  public readonly maximum: number = Resources.progressMaximum;
  public readonly label = input.required<string>();
  public readonly value = input<number | null>(null);
  public readonly fraction: Signal<number | null> = computed(() => {
    const value = this.value();
    return value === null ? null : Math.min(Math.max(value, this.minimum), this.maximum);
  });
  public readonly isIndeterminate: Signal<boolean> = computed(() => this.fraction() === null);
}
