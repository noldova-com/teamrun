/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, type InputSignal, input, type Signal } from "@angular/core";
import type { NodeType } from "@noldova/teamrun.protocol";
import { ColorChoices } from "@noldova/ui.components.angular";

@Component({
  selector: "nol-teamrun-organization-type-icon",
  templateUrl: "./organization-type-icon.component.html",
  styleUrl: "./organization-type-icon.component.css"
})
export class OrganizationTypeIconComponent {
  public readonly type: InputSignal<NodeType | null> = input.required<NodeType | null>();

  protected readonly color: Signal<string | null> = computed(() => ColorChoices.toCss(this.type()?.color ?? null));
}
