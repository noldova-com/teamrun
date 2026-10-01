/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import { PanelSurface } from "../../enums/panel-surface";

@Component({
  selector: "tr-panel-card",
  templateUrl: "./panel-card.component.html",
  styleUrl: "./panel-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.tr-panel-card-shell]": "isShell()"
  }
})
export class PanelCardComponent {
  public readonly surface = input<PanelSurface>(PanelSurface.Panel);
  public readonly isShell: Signal<boolean> = computed(() => this.surface() === PanelSurface.Shell);
}
