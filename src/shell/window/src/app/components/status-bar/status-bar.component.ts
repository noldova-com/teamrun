/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { BarItemsService } from "../../services/bar-items.service";
import { ModuleFailuresComponent } from "../module-failures/module-failures.component";
import { StatusBarItemComponent } from "../status-bar-item/status-bar-item.component";

@Component({
  selector: "tr-status-bar",
  imports: [ModuleFailuresComponent, StatusBarItemComponent],
  templateUrl: "./status-bar.component.html",
  styleUrl: "./status-bar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "data-tr-chrome": "bottom"
  }
})
export class StatusBarComponent {
  protected readonly bars: BarItemsService = inject(BarItemsService);
}
