/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input, output } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { SelectOption } from "../../models/select-option";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-choice-pills",
  templateUrl: "./choice-pills.component.html",
  styleUrl: "./choice-pills.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-choice-pills"
  }
})
export class ChoicePillsComponent {
  public readonly options = input.required<readonly SelectOption[]>();
  public readonly value = input.required<string>();
  public readonly label = input.required<string>();
  public readonly describedBy = input<string | null>(null);
  public readonly valueChange = output<string>();

  protected readonly tabStop: Signal<string | undefined> = computed(() => (this.options().find(t => t.value === this.value()) ?? this.options()[0])?.value);

  protected choose(value: string): void {
    if (value !== this.value())
      this.valueChange.emit(value);
  }

  protected move(event: KeyboardEvent, group: HTMLElement): void {
    if (!(event.target instanceof HTMLButtonElement))
      return;
    const pills = [...group.querySelectorAll<HTMLButtonElement>(Resources.choicePillSelector)];
    const target = Resources.choicePillTargets.get(event.key)?.(pills.indexOf(event.target), pills.length - 1);
    if (Object.isUndefined(target))
      return;
    event.preventDefault();
    this.choose((this.options()[target] as SelectOption).value);
    (pills[target] as HTMLButtonElement).focus();
  }
}
