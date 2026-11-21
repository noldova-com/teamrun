/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, input } from "@angular/core";

import type { Teammate } from "@noldova/teamrun.protocol";

import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";

@Component({
  selector: "nol-teamrun-organization-card",
  imports: [TeammateAvatarComponent],
  host: { class: "nol-teamrun-organization-card" },
  templateUrl: "./organization-card.component.html",
  styleUrl: "./organization-card.component.css"
})
export class OrganizationCardComponent {
  public readonly teammate: InputSignal<Teammate> = input.required<Teammate>();
}
