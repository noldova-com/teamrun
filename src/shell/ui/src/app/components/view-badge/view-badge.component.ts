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
  selector: "tr-view-badge",
  templateUrl: "./view-badge.component.html",
  styleUrl: "./view-badge.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-view-badge",
    "aria-hidden": "true",
    "[class.tr-view-badge-dot]": "isDot()"
  }
})
export class ViewBadgeComponent {
  protected readonly isDot: Signal<boolean> = computed(() => Object.isNull(this.count()));
  protected readonly text: Signal<string> = computed(() => {
    const count = this.count();
    return Object.isNull(count) ? String.empty : Resources.formatBadgeCount(count);
  });

  public readonly count = input<number | null>(null);
}
