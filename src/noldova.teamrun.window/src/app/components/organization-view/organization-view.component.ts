/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, signal, type Signal, type WritableSignal } from "@angular/core";

import { AvatarComponent, ButtonComponent, ButtonVariant, CanvasComponent, CanvasFitAlignment, CanvasItemDirective, ChoicePillsComponent, MenuComponent,
  MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationViewMode } from "../../enums/organization-view-mode";
import { OrganizationLayout } from "../../models/organization-layout";
import { OrganizationNode } from "../../models/organization-node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationBoardComponent } from "../organization-board/organization-board.component";
import { OrganizationDepartmentComponent } from "../organization-department/organization-department.component";
import { OrganizationFocusComponent } from "../organization-focus/organization-focus.component";

@Component({
  selector: "nol-teamrun-organization-view",
  imports: [AvatarComponent, ButtonComponent, CanvasComponent, CanvasItemDirective, ChoicePillsComponent, MenuComponent, MenuGroupComponent, MenuItemComponent,
    MenuSeparatorComponent, MenuTriggerDirective, OrganizationBoardComponent, OrganizationDepartmentComponent, OrganizationFocusComponent],
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
  protected readonly modes: typeof OrganizationViewMode = OrganizationViewMode;
  protected readonly editing: WritableSignal<boolean> = signal(false);
  protected readonly mode: Signal<OrganizationViewMode> = computed(() => this.layout.layout().view);
  protected readonly tree: Signal<readonly OrganizationNode[]> = computed(() => OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()));
  protected readonly headcount: Signal<string> = computed(() => Resources.formatOrganizationHeadcount(this.store.teammates().length));
  protected readonly ownerRole: Signal<string> = computed(() => Resources.formatOrganizationOwnerRole(this.tree().filter(t => !Object.isNull(t.leader)).length));
  protected readonly viewOptions: readonly SelectOption[] = Object.values(OrganizationViewMode).map(t => new SelectOption(t, Resources.organizationViewLabels[t]));

  protected toggleEditing(): void {
    this.editing.update(t => !t);
  }

  protected addDepartment(): void {
    void this.organization.createDepartment(Resources.organizationNewDepartment, null);
  }

  protected showView(value: string): void {
    this.layout.showView(OrganizationLayout.viewOf(value));
  }
}
