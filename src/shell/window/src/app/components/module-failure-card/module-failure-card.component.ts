/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type InputSignal, input } from "@angular/core";

import type { ModuleFailure } from "../../models/module-failure";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-module-failure-card",
  templateUrl: "./module-failure-card.component.html",
  styleUrl: "./module-failure-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleFailureCardComponent {
  protected readonly resources: typeof Resources = Resources;

  public readonly failure: InputSignal<ModuleFailure> = input.required<ModuleFailure>();
}
