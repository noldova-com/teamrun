/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, signal, type Signal, type WritableSignal } from "@angular/core";

import { OrganizationTarget } from "@noldova/teamrun.protocol";

import { AvatarComponent, ButtonComponent, ButtonVariant, CanvasComponent, CanvasFitAlignment, CanvasItemDirective, MenuComponent, MenuGroupComponent,
  MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, SelectComponent, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationMessagesShape } from "../../enums/organization-messages-shape";
import { OrganizationConversation } from "../../models/organization-conversation";
import { OrganizationTargetChoice } from "../../models/organization-target-choice";
import { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationDepartmentComponent } from "../organization-department/organization-department.component";
import { OrganizationMessagesComponent } from "../organization-messages/organization-messages.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";

@Component({
  selector: "nol-teamrun-organization-view",
  imports: [AvatarComponent, ButtonComponent, CanvasComponent, CanvasItemDirective, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent,
    MenuTriggerDirective, OrganizationDepartmentComponent, OrganizationMessagesComponent, SelectComponent, TeammateStatusComponent],
  providers: [ChatStoreService.provider, OrganizationStoreService.provider, OrganizationLayoutService.provider],
  host: { class: "nol-teamrun-organization-view" },
  templateUrl: "./organization-view.component.html",
  styleUrls: ["../organization-tree.css", "./organization-view.component.css"]
})
export class OrganizationViewComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly top: CanvasFitAlignment = CanvasFitAlignment.Top;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly editing: WritableSignal<boolean> = signal(false);
  protected readonly thread: OrganizationMessagesShape = OrganizationMessagesShape.Thread;
  protected readonly chosen: WritableSignal<OrganizationTarget | null> = signal(null);
  protected readonly tree: Signal<readonly OrganizationNode[]> = computed(() => OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()));
  protected readonly headcount: Signal<string> = computed(() =>
    Resources.formatOrganizationHeadcount(this.store.teammates().length, OrganizationNode.departmentsOf(this.organization.organization()).length));
  protected readonly target: Signal<OrganizationTarget | null> = computed(() => {
    const first = this.tree()[0];
    return this.chosen() ?? (Object.isUndefined(first) ? null : OrganizationTarget.department(first.department.id));
  });
  protected readonly choices: Signal<readonly OrganizationTargetChoice[]> = computed(() => OrganizationTargetChoice.of(this.tree()));
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => this.choices().map(t => new SelectOption(t.key, t.label)));
  protected readonly targetKey: Signal<string> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? String.empty : OrganizationConversation.keyOf(target);
  });
  protected readonly ownerRole: Signal<string> = computed(() => Resources.formatOrganizationOwnerRole(this.tree().filter(t => !Object.isNull(t.leader)).length));

  protected toggleEditing(): void {
    this.editing.update(t => !t);
  }

  protected addDepartment(): void {
    void this.organization.createDepartment(Resources.organizationNewDepartment, null);
  }

  protected pick(key: string): void {
    const found = this.choices().find(t => t.key === key);
    if (!Object.isUndefined(found))
      this.chosen.set(found.target);
  }
}
