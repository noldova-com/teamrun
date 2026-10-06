/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type Signal, viewChild } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { ContextMenuTriggerDirective } from "@noldova/teamrun-shell-ui";

import { EditTarget } from "../../models/edit-target";
import { PlaceMenuComponent } from "../place-menu/place-menu.component";
import { Resources } from "../../../resources";

@Component({
  selector: "tr-field-menu",
  imports: [ContextMenuTriggerDirective, PlaceMenuComponent],
  templateUrl: "./field-menu.component.html",
  styleUrl: "./field-menu.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:contextmenu)": "openAtPointer($event)",
    "(document:keydown)": "openFromKeyboard($event)"
  }
})
export class FieldMenuComponent {
  private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);

  protected readonly resources: typeof Resources = Resources;

  protected openAtPointer(event: MouseEvent): void {
    const field = FieldMenuComponent.targetOf(event);
    if (!Object.isNull(field))
      this.trigger().openAtPointer(event, field);
  }

  protected openFromKeyboard(event: KeyboardEvent): void {
    const field = FieldMenuComponent.targetOf(event);
    if (!Object.isNull(field))
      this.trigger().openFromKeyboard(event, field);
  }

  private static targetOf(event: Event): HTMLElement | null {
    const element = event.target;
    if (event.defaultPrevented || !(element instanceof HTMLElement) || !Object.isNull(element.closest(Resources.transientFocusSelector)))
      return null;
    return EditTarget.fieldOf(element);
  }
}
