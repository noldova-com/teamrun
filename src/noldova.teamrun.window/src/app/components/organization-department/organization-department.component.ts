/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, inject, type InputSignal, input, type OutputEmitterRef, output, type Signal } from "@angular/core";

import { type Department, OrganizationParent, OrganizationTarget, type Teammate } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CanvasItemDirective, DialogService, IconButtonComponent, OverlayAlignment, OverlaySide, PopoverOpening, PopoverTriggerDirective }
  from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { FlowLineShape } from "../../enums/flow-line-shape";
import { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationUnitSelection } from "../../services/organization-unit-selection";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";
import { OrganizationDepartmentDialogComponent } from "../organization-department-dialog/organization-department-dialog.component";
import { OrganizationDetailsComponent } from "../organization-details/organization-details.component";
import { OrganizationDropDirective } from "../organization-drop.directive";
import { OrganizationAddTeammateDirective } from "../organization-add-teammate.directive";
import { OrganizationTypeIconComponent } from "../organization-type-icon/organization-type-icon.component";

@Component({
  selector: "nol-teamrun-organization-department",
  imports: [ButtonComponent, CanvasItemDirective, IconButtonComponent, NgTemplateOutlet, OrganizationCardComponent, OrganizationDetailsComponent,
    OrganizationDropDirective, OrganizationAddTeammateDirective, OrganizationTypeIconComponent, PopoverTriggerDirective],
  providers: [ChatStoreService.provider, OrganizationLayoutService.provider, OrganizationStoreService.provider, TeammateStatusStoreService.provider, OrganizationUnitSelection.provider],
  host: { class: "nol-teamrun-organization-department" },
  templateUrl: "./organization-department.component.html",
  styleUrls: ["../organization-tree.css", "./organization-department.component.css"]
})
export class OrganizationDepartmentComponent {
  private readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly statuses: TeammateStatusStoreService = inject(TeammateStatusStoreService);
  private readonly selection: OrganizationUnitSelection = inject(OrganizationUnitSelection);

  public readonly node: InputSignal<OrganizationNode> = input.required<OrganizationNode>();
  public readonly editing: InputSignal<boolean> = input(false);
  public readonly department: InputSignal<Department | null> = input<Department | null>(null);
  public readonly flowParent: InputSignal<string> = input(Resources.organizationFlowPersonKey);

  public readonly chosen: OutputEmitterRef<OrganizationTarget> = output<OrganizationTarget>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly lines: typeof FlowLineShape = FlowLineShape;
  protected readonly flowKey: Signal<string> = computed(() => Resources.formatOrganizationFlowDepartmentKey(this.node().id));
  protected readonly flowHead: Signal<string> = computed(() => this.node().teammate?.id ?? this.node().leader?.id ?? this.flowKey());
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly target: typeof OrganizationTarget = OrganizationTarget;
  protected readonly detailsOpening: PopoverOpening = PopoverOpening.Hover;
  protected readonly detailsSide: OverlaySide = OverlaySide.below;
  protected readonly detailsAlignment: OverlayAlignment = OverlayAlignment.Start;
  protected readonly isOpen: Signal<boolean> = computed(() => !this.layout.layout().isCollapsed(this.node().id));
  protected readonly summary: Signal<string> = computed(() => {
    const node = this.node();
    const people = Object.isNull(node.leader) ? node.members : [node.leader, ...node.members];
    return Resources.formatOrganizationDepartmentSummary(people.map(t => this.statuses.statusOf(t.id)()));
  });
  protected readonly isSelected: Signal<boolean> = computed(() => this.selection.unitId() === this.node().id);

  protected keyOf(teammate: Teammate): OrganizationParent {
    return OrganizationParent.teammate(teammate.id);
  }

  protected select(): void {
    this.selection.select(this.node().id);
  }

  protected selectFromCard(event: MouseEvent): void {
    if (this.editing() && event.target instanceof Element && Object.isNull(event.target.closest("button")))
      this.select();
  }

  protected toggle(): void {
    this.layout.toggleDepartment(this.node().id);
  }

  protected addDepartment(): void {
    OrganizationDepartmentDialogComponent.open(this.dialogs, this.store, this.organization, this.node().key);
  }
}
