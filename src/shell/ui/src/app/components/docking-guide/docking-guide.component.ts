/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, computed, input } from "@angular/core";

import { DockingDirection } from "../../enums/docking-direction";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-docking-guide",
  templateUrl: "./docking-guide.component.html",
  styleUrl: "./docking-guide.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "role": "img",
    "[attr.aria-label]": "label()",
    "[attr.data-direction]": "direction()",
    "[class.tr-docking-guide-chosen]": "chosen()"
  }
})
export class DockingGuideComponent {
  protected readonly glyph: Signal<string> = computed(() => Resources.dockingGlyphs[this.direction()]);
  protected readonly label: Signal<string> = computed(() => Resources.dockingLabels[this.direction()]);

  public readonly direction = input.required<DockingDirection>();
  public readonly chosen = input<boolean>(false);
}
