/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, input, type InputSignal, type Signal } from "@angular/core";
import "@noldova/context.core";
import type { MessageDetail } from "@noldova/teamrun.protocol";

import { Resources } from "../../../resources";
import { FormatterService } from "../../services/formatter.service";

@Component({
  selector: "nol-teamrun-usage-hand-off-line",
  templateUrl: "./usage-hand-off-line.component.html",
  styleUrls: ["../note-line.css", "./usage-hand-off-line.component.css"]
})
export class UsageHandOffLineComponent {
  public readonly note: InputSignal<MessageDetail> = input.required<MessageDetail>();
  public readonly labelId: InputSignal<string | null> = input<string | null>(null);

  protected readonly glyph: Signal<string> = computed(() => FormatterService.handsOff(this.note()) ? Resources.usageHandedOffGlyph : Resources.usageStoppedGlyph);
}
