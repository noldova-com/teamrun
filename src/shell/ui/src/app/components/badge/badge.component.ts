/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";

@Component({
  selector: "tr-badge",
  templateUrl: "./badge.component.html",
  styleUrl: "./badge.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-badge",
    "aria-hidden": "true",
    "[class.tr-badge-dot]": "isDot()"
  }
})
export class BadgeComponent {
  public readonly count = input<number | null>(null);
  public readonly isDot: Signal<boolean> = computed(() => Object.isNull(this.count()));
  public readonly text: Signal<string> = computed(() => {
    const count = this.count();
    return Object.isNull(count) ? String.empty : count > Resources.badgeLimit ? Resources.badgeOverflow : String(count);
  });
}
