/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import { TextMatch } from "../../models/settings/text-match";
import { WordBreaks } from "../../models/settings/word-breaks";

@Component({
  selector: "tr-highlighted-text",
  imports: [NgTemplateOutlet],
  template: `<ng-template #pieces let-part>@for (piece of part.pieces; track $index) {@if (!$first) {<wbr>}{{ piece }}}</ng-template>@for (part of parts(); track $index) {@if (part.breaksBefore) {<wbr>}@if (part.isMatch) {<mark class="tr-highlighted-text-match"><ng-container *ngTemplateOutlet="pieces; context: { $implicit: part }" /></mark>} @else {<ng-container *ngTemplateOutlet="pieces; context: { $implicit: part }" />}}`,
  styleUrl: "./highlighted-text.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HighlightedTextComponent {
  public readonly text = input.required<string>();
  public readonly query = input<string>("");
  public readonly breaksWords = input<boolean>(false);

  protected readonly parts: Signal<readonly TextMatch[]> = computed(() => {
    const parts = TextMatch.split(this.text(), this.query());
    return this.breaksWords() ? WordBreaks.split(parts) : parts;
  });
}
