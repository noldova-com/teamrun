/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, computed, inject, type InputSignal, input, type Signal, viewChild } from "@angular/core";

import { NameOrder, type Teammate } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CanvasItemDirective, ChipComponent, DialogService, IconButtonComponent, MenuComponent, MenuItemComponent,
  MenuTriggerDirective, SelectComponent, SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ConfirmRequest } from "../../models/confirm-request";
import type { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";

@Component({
  selector: "nol-teamrun-organization-department",
  imports: [ButtonComponent, CanvasItemDirective, ChipComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective,
    OrganizationCardComponent, SelectComponent, TextFieldComponent],
  providers: [ChatStoreService.provider, OrganizationLayoutService.provider, OrganizationStoreService.provider],
  host: { class: "nol-teamrun-organization-department" },
  templateUrl: "./organization-department.component.html",
  styleUrls: ["../organization-tree.css", "./organization-department.component.css"]
})
export class OrganizationDepartmentComponent {
  private readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly nameField: Signal<ElementRef<HTMLInputElement>> = viewChild.required<string, ElementRef<HTMLInputElement>>("name", { read: ElementRef });

  public readonly node: InputSignal<OrganizationNode> = input.required<OrganizationNode>();
  public readonly editing: InputSignal<boolean> = input(false);

  protected readonly resources: typeof Resources = Resources;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly isOpen: Signal<boolean> = computed(() => !this.layout.layout().isCollapsed(this.node().department.id));
  protected readonly summary: Signal<string> = computed(() =>
    Resources.formatOrganizationDepartmentSummary(this.node().leader?.name ?? null, this.node().members.length));
  protected readonly leaderOptions: Signal<readonly SelectOption[]> = computed(() => {
    const node = this.node();
    const people = Object.isNull(node.leader) ? node.members : [node.leader, ...node.members];
    return [new SelectOption(String.empty, Resources.organizationNoLeader), ...NameOrder.sort(people, t => t.name).map(t => new SelectOption(t.id, t.name))];
  });
  protected readonly candidates: Signal<readonly Teammate[]> = computed(() => {
    const id = this.node().department.id;
    const members = this.organization.organization().members;
    return NameOrder.sort(this.store.teammates().filter(t => !members.some(u => u.teammateId === t.id && u.departmentId === id)), t => t.name);
  });

  protected toggle(): void {
    this.layout.toggleDepartment(this.node().department.id);
  }

  protected rename(): void {
    const field = this.nameField().nativeElement;
    const department = this.node().department;
    const name = field.value.trim();
    if (name.length === 0 || name === department.name) {
      field.value = department.name;
      return;
    }
    void this.organization.renameDepartment(department.id, name);
  }

  protected setLeader(value: string): void {
    void this.organization.setLeader(this.node().department.id, value.length === 0 ? null : value);
  }

  protected add(teammateId: string): void {
    void this.organization.setMember(teammateId, this.node().department.id);
  }

  protected confirmDelete(): void {
    const department = this.node().department;
    const parent = this.organization.organization().departments.find(t => t.id === department.parentId)?.name ?? null;
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", new ConfirmRequest(Resources.organizationDeleteDepartmentTitle,
      Resources.formatOrganizationDeleteDepartment(department.name, parent), Resources.organizationDeleteLabel, null, true));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void this.organization.deleteDepartment(department.id);
    });
  }
}
