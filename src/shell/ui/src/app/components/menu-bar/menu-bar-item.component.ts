/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkMenuBar, CdkMenuItem } from "@angular/cdk/menu";
import { ChangeDetectionStrategy, Component, effect, inject, input } from "@angular/core";

@Component({
  selector: "button[tr-menu-bar-item]",
  template: "{{ label() }}",
  styleUrl: "./menu-bar-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: CdkMenuItem, inputs: ["cdkMenuItemDisabled: disabled"], outputs: ["cdkMenuItemTriggered: triggered"] }],
  host: {
    "(focus)": "bar.setActiveMenuItem(item)"
  }
})
export class MenuBarItemComponent {
  protected readonly bar: CdkMenuBar = inject(CdkMenuBar);
  protected readonly item: CdkMenuItem = inject(CdkMenuItem, { self: true });

  public readonly label = input.required<string>();

  public constructor() {
    effect(() => this.item.typeaheadLabel = this.label());
  }
}
