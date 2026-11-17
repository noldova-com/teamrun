/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, input, type InputSignal } from "@angular/core";
import { PopoverDirective } from "@noldova/ui.components.angular";

import type { ReplyStats } from "../../models/reply-stats";

@Component({
  selector: "nol-teamrun-reply-stats",
  hostDirectives: [{ directive: PopoverDirective, inputs: ["label"] }],
  templateUrl: "./reply-stats.component.html",
  styleUrl: "./reply-stats.component.css"
})
export class ReplyStatsComponent {
  public readonly stats: InputSignal<ReplyStats> = input.required<ReplyStats>();
}
