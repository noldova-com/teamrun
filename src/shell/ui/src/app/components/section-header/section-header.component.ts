/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { Resources } from "../../../resources";

@Component({
  selector: "tr-section-header",
  template: "{{ label() }}",
  styleUrl: "./section-header.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "class": "tr-section-header",
    "role": "heading",
    "[attr.aria-level]": "level()"
  }
})
export class SectionHeaderComponent {
  public readonly label = input.required<string>();
  public readonly level = input<number>(Resources.sectionHeaderLevel);
}
