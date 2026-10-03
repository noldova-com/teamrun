/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { Resources } from "../../../resources";

@Component({
  selector: "tr-checkbox",
  templateUrl: "./checkbox.component.html",
  styleUrl: "./checkbox.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-checkbox"
  }
})
export class CheckboxComponent {
  protected readonly resources: typeof Resources = Resources;

  public readonly checked = input<boolean>(false);
  public readonly disabled = input<boolean>(false);
  public readonly checkedChange = output<boolean>();

  protected toggle(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
