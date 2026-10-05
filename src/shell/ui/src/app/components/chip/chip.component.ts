/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { ChipKind } from "../../enums/chip-kind";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-chip",
  templateUrl: "./chip.component.html",
  styleUrl: "./chip.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-chip",
    "[class.tr-chip-count]": "kind() === kinds.Count",
    "[class.tr-chip-added]": "kind() === kinds.Added",
    "[class.tr-chip-removed]": "kind() === kinds.Removed",
    "[class.tr-chip-key]": "kind() === kinds.Key"
  }
})
export class ChipComponent {
  protected readonly kinds: typeof ChipKind = ChipKind;
  protected readonly text: Signal<string> = computed(() => {
    const count = this.count();
    switch (this.kind()) {
      case ChipKind.Added:
        return `${Resources.chipAddedSign}${count}`;
      case ChipKind.Removed:
        return `${Resources.chipRemovedSign}${count}`;
      case ChipKind.Key:
        return String.empty;
      default:
        return Resources.formatBadgeCount(count);
    }
  });

  public readonly kind = input<ChipKind>(ChipKind.Count);
  public readonly count = input<number>(0);
}
