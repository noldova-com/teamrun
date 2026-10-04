/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { PopoverTriggerDirective } from "@noldova/teamrun-shell-ui";

import type { ModuleFailure } from "../../models/module-failure";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { Resources } from "../../../resources";
import { ModuleFailuresPopoverComponent } from "../module-failures-popover/module-failures-popover.component";

@Component({
  selector: "tr-module-failures",
  imports: [ModuleFailuresPopoverComponent, PopoverTriggerDirective],
  templateUrl: "./module-failures.component.html",
  styleUrl: "./module-failures.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleFailuresComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly failures: Signal<readonly ModuleFailure[]> = inject(WindowPartHostService).failures;
}
