/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, type InputSignal, type Signal, type WritableSignal, computed, inject, input, signal } from "@angular/core";
import { OrganizationNodeKind, type OrganizationParent } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { OrganizationPlaceChoice } from "../models/organization-place-choice";
import { OrganizationStoreService } from "../services/organization-store.service";

@Directive({
  selector: "[nolTeamrunOrganizationDrop]",
  host: {
    "[attr.draggable]": "draggable()",
    "[class.nol-teamrun-organization-drop-over]": "isOver()",
    "(dragstart)": "start($event)",
    "(dragover)": "over($event)",
    "(dragleave)": "isOver.set(false)",
    "(dragend)": "end()",
    "(drop)": "drop($event)"
  }
})
export class OrganizationDropDirective {
  private static dragging: string | null = null;

  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);

  public readonly node: InputSignal<OrganizationParent> = input.required<OrganizationParent>({ alias: "nolTeamrunOrganizationDrop" });
  public readonly editing: InputSignal<boolean> = input(false, { alias: "nolTeamrunOrganizationDropEditing" });

  protected readonly isOver: WritableSignal<boolean> = signal(false);
  protected readonly draggable: Signal<string | null> = computed(() =>
    this.editing() && this.node().kind !== OrganizationNodeKind.Person ? Resources.organizationDraggable : null);

  protected start(event: DragEvent): void {
    if (Object.isNull(this.draggable()) || Object.isNull(event.dataTransfer))
      return;
    event.stopPropagation();
    OrganizationDropDirective.dragging = OrganizationPlaceChoice.keyOf(this.node());
    event.dataTransfer.setData(Resources.organizationDragType, OrganizationDropDirective.dragging);
    event.dataTransfer.effectAllowed = Resources.organizationDragEffect;
  }

  protected over(event: DragEvent): void {
    if (!this.editing() || Object.isNull(event.dataTransfer) || !event.dataTransfer.types.includes(Resources.organizationDragType))
      return;
    event.stopPropagation();
    if (OrganizationDropDirective.dragging === OrganizationPlaceChoice.keyOf(this.node()))
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = Resources.organizationDragEffect;
    this.isOver.set(true);
  }

  protected drop(event: DragEvent): void {
    this.isOver.set(false);
    if (!this.editing() || Object.isNull(event.dataTransfer))
      return;
    event.preventDefault();
    event.stopPropagation();
    const key = event.dataTransfer.getData(Resources.organizationDragType);
    const parent = this.node();
    if (key === OrganizationPlaceChoice.keyOf(parent))
      return;
    for (const id of OrganizationPlaceChoice.idsOf(key, OrganizationNodeKind.Department))
      void this.organization.moveDepartment(id, parent);
    for (const id of OrganizationPlaceChoice.idsOf(key, OrganizationNodeKind.Teammate))
      void this.organization.placeTeammate(id, parent);
  }

  protected end(): void {
    OrganizationDropDirective.dragging = null;
  }
}
