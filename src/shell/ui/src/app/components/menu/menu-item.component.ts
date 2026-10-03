/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkMenuItem } from "@angular/cdk/menu";
import { ChangeDetectionStrategy, Component, effect, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../../resources";
import { MenuTriggerDirective } from "./menu-trigger.directive";

@Component({
  selector: "button[tr-menu-item]",
  templateUrl: "./menu-item.component.html",
  styleUrl: "./menu-item.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: CdkMenuItem, inputs: ["cdkMenuItemDisabled: disabled"], outputs: ["cdkMenuItemTriggered: triggered"] }],
  host: {
    "[attr.role]": "checked() === null ? resources.menuItemRole : checkbox() ? resources.menuItemCheckboxRole : resources.menuItemRadioRole",
    "[attr.aria-checked]": "checked()"
  }
})
export class MenuItemComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly hasSubmenu: boolean = !Object.isNull(inject(MenuTriggerDirective, { self: true, optional: true }));

  public readonly label = input.required<string>();
  public readonly icon = input<string | null>(null);
  public readonly checked = input<boolean | null>(null);
  public readonly checkbox = input<boolean>(false);
  public readonly shortcut = input<string | null>(null);

  public constructor() {
    const item = inject(CdkMenuItem, { self: true });
    effect(() => item.typeaheadLabel = this.label());
  }
}
