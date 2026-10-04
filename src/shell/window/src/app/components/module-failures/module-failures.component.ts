/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { ModuleFailure } from "../../models/module-failure";
import { ModuleSelectionService } from "../../services/module-selection.service";
import { WindowPartHostService } from "../../services/window-part-host.service";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-module-failures",
  templateUrl: "./module-failures.component.html",
  styleUrl: "./module-failures.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleFailuresComponent {
  private readonly selection: ModuleSelectionService = inject(ModuleSelectionService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly failures: Signal<readonly ModuleFailure[]> = inject(WindowPartHostService).failures;

  protected open(id: string): void {
    this.selection.open(id);
  }
}
