/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { RevealDelayDirective } from "../progress/reveal-delay.directive";

@Component({
  selector: "tr-spinner",
  templateUrl: "./spinner.component.html",
  styleUrl: "./spinner.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: RevealDelayDirective, inputs: ["isDelayed"] }],
  host: {
    "[attr.role]": "label() ? 'status' : null"
  }
})
export class SpinnerComponent {
  protected readonly reveal: RevealDelayDirective = inject(RevealDelayDirective, { self: true });

  public readonly label = input<string>(String.empty);
}
