/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "tr-settings-row",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings-row.component.html"
})
export class SettingsRowComponent {
  public readonly label = input.required<string>();
  public readonly hint = input<string | null>(null);
}
