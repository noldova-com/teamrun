/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type Signal } from "@angular/core";

import { AvatarComponent, ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationNode } from "../../models/organization-node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationDepartmentComponent } from "../organization-department/organization-department.component";

@Component({
  selector: "nol-teamrun-organization-view",
  imports: [AvatarComponent, ButtonComponent, OrganizationDepartmentComponent],
  providers: [ChatStoreService.provider, OrganizationStoreService.provider, OrganizationLayoutService.provider],
  host: { class: "nol-teamrun-organization-view" },
  templateUrl: "./organization-view.component.html",
  styleUrls: ["../organization-tree.css", "./organization-view.component.css"]
})
export class OrganizationViewComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly tree: Signal<readonly OrganizationNode[]> = computed(() => OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()));
  protected readonly headcount: Signal<string> = computed(() => Resources.formatOrganizationHeadcount(this.store.teammates().length));
  protected readonly ownerRole: Signal<string> = computed(() => Resources.formatOrganizationOwnerRole(this.tree().filter(t => !Object.isNull(t.leader)).length));
}
