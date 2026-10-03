/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import { TextMatch } from "../../models/settings/text-match";

@Component({
  selector: "tr-highlighted-text",
  template: `@for (part of parts(); track $index) {@if (part.isMatch) {<mark class="tr-highlighted-text-match">{{ part.text }}</mark>} @else {{{ part.text }}}}`,
  styleUrl: "./highlighted-text.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HighlightedTextComponent {
  public readonly text = input.required<string>();
  public readonly query = input<string>("");

  protected readonly parts: Signal<readonly TextMatch[]> = computed(() => TextMatch.split(this.text(), this.query()));
}
