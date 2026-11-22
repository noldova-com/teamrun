/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, ElementRef, computed, inject, type InputSignal, input, type OutputEmitterRef, output, type Signal, viewChild } from "@angular/core";

import { type Department, NameOrder, OrganizationParent, OrganizationTarget, type Teammate } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CanvasItemDirective, DialogService, IconButtonComponent, OverlayAlignment, OverlaySide, PopoverOpening, PopoverTriggerDirective, SelectComponent, SelectOption, TextFieldComponent }
  from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { FlowLineShape } from "../../enums/flow-line-shape";
import { OrganizationEdits } from "../../models/organization-edits";
import { OrganizationPlaceChoice } from "../../models/organization-place-choice";
import { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";
import { OrganizationDepartmentDialogComponent } from "../organization-department-dialog/organization-department-dialog.component";
import { OrganizationDetailsComponent } from "../organization-details/organization-details.component";
import { OrganizationDropDirective } from "../organization-drop.directive";
import { OrganizationTeammateSearchComponent } from "../organization-teammate-search/organization-teammate-search.component";

@Component({
  selector: "nol-teamrun-organization-department",
  imports: [ButtonComponent, CanvasItemDirective, IconButtonComponent, NgTemplateOutlet, OrganizationCardComponent, OrganizationDetailsComponent,
    OrganizationDropDirective, OrganizationTeammateSearchComponent, PopoverTriggerDirective, SelectComponent, TextFieldComponent],
  providers: [ChatStoreService.provider, OrganizationLayoutService.provider, OrganizationStoreService.provider, TeammateStatusStoreService.provider],
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
  private readonly nameField: Signal<ElementRef<HTMLInputElement>> = viewChild.required<string, ElementRef<HTMLInputElement>>("name", { read: ElementRef });

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
  protected readonly textVariant: ButtonVariant = ButtonVariant.Text;
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
  protected readonly leaderOptions: Signal<readonly SelectOption[]> = computed(() => {
    const node = this.node();
    const people = NameOrder.sort(Object.isNull(node.leader) ? node.members : [node.leader, ...node.members], t => t.name);
    const others = NameOrder.sort(this.store.teammates().filter(t => !people.some(u => u.id === t.id)), t => t.name);
    return [new SelectOption(String.empty, Resources.organizationNoLeader), ...[...people, ...others].map(t => new SelectOption(t.id, t.name))];
  });
  protected readonly clickOpening: PopoverOpening = PopoverOpening.Click;
  protected readonly placeChoices: Signal<readonly OrganizationPlaceChoice[]> = computed(() =>
    OrganizationPlaceChoice.of(OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()), this.node().key));
  protected readonly placeOptions: Signal<readonly SelectOption[]> = computed(() => this.placeChoices().map(t => new SelectOption(t.key, t.label)));
  protected placeKeyOf(department: Department): string {
    return OrganizationPlaceChoice.keyOf(department.parent);
  }

  protected keyOf(teammate: Teammate): OrganizationParent {
    return OrganizationParent.teammate(teammate.id);
  }

  protected toggle(): void {
    this.layout.toggleDepartment(this.node().id);
  }

  protected rename(department: Department): void {
    const field = this.nameField().nativeElement;
    const name = field.value.trim();
    if (name.length === 0 || name === department.name) {
      field.value = department.name;
      return;
    }
    void this.organization.renameDepartment(department.id, name);
  }

  protected setLeader(value: string): void {
    void this.organization.setLeader(this.node().id, value.length === 0 ? null : value);
  }

  protected move(department: Department, key: string): void {
    for (const choice of this.placeChoices().filter(t => t.key === key))
      void this.organization.moveDepartment(department.id, choice.parent);
  }

  protected addDepartment(): void {
    OrganizationDepartmentDialogComponent.open(this.dialogs, this.store, this.organization, this.node().key);
  }

  protected confirmDelete(department: Department): void {
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", OrganizationEdits.deleteRequest(department, [...this.organization.organization().departments, ...this.store.teammates()]));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void this.organization.deleteDepartment(department.id);
    });
  }
}
