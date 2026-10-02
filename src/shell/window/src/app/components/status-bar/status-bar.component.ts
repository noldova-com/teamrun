/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ModuleFailuresComponent } from "../module-failures/module-failures.component";

@Component({
  selector: "tr-status-bar",
  imports: [ModuleFailuresComponent],
  templateUrl: "./status-bar.component.html",
  styleUrl: "./status-bar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "data-tr-chrome": "bottom"
  }
})
export class StatusBarComponent {
}
