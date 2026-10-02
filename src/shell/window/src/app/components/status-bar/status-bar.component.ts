/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "tr-status-bar",
  templateUrl: "./status-bar.component.html",
  styleUrl: "./status-bar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBarComponent {
}
