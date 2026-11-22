/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, linkedSignal, signal, type Signal, type WritableSignal } from "@angular/core";

import { OrganizationTarget, type Teammate } from "@noldova/teamrun.protocol";

import { AvatarComponent, ButtonComponent, ButtonVariant, CanvasComponent, CanvasFitAlignment, CanvasItemDirective, ChoicePillsComponent, MenuComponent,
  MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, OverlayAlignment, OverlaySide, PopoverOpening, PopoverTriggerDirective,
  SelectComponent, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationMessagesShape } from "../../enums/organization-messages-shape";
import { OrganizationViewMode } from "../../enums/organization-view-mode";
import { OrganizationConversation } from "../../models/organization-conversation";
import { OrganizationFocus } from "../../models/organization-focus";
import { OrganizationLayout } from "../../models/organization-layout";
import { OrganizationTargetChoice } from "../../models/organization-target-choice";
import { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationBoardComponent } from "../organization-board/organization-board.component";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";
import { OrganizationDepartmentComponent } from "../organization-department/organization-department.component";
import { OrganizationDetailsComponent } from "../organization-details/organization-details.component";
import { OrganizationFocusComponent } from "../organization-focus/organization-focus.component";
import { OrganizationMessagesComponent } from "../organization-messages/organization-messages.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";

@Component({
  selector: "nol-teamrun-organization-view",
  imports: [AvatarComponent, ButtonComponent, CanvasComponent, CanvasItemDirective, ChoicePillsComponent, MenuComponent, MenuGroupComponent, MenuItemComponent,
    MenuSeparatorComponent, MenuTriggerDirective, OrganizationBoardComponent, OrganizationCardComponent, OrganizationDepartmentComponent, OrganizationDetailsComponent,
    OrganizationFocusComponent, OrganizationMessagesComponent, PopoverTriggerDirective, SelectComponent, TeammateStatusComponent],
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
  protected readonly detailsOpening: PopoverOpening = PopoverOpening.Hover;
  protected readonly detailsSide: OverlaySide = OverlaySide.below;
  protected readonly detailsAlignment: OverlayAlignment = OverlayAlignment.Start;
  protected readonly targets: typeof OrganizationTarget = OrganizationTarget;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly shapes: typeof OrganizationMessagesShape = OrganizationMessagesShape;
  protected readonly editing: WritableSignal<boolean> = signal(false);
  protected readonly modes: typeof OrganizationViewMode = OrganizationViewMode;
  protected readonly mode: Signal<OrganizationViewMode> = computed(() => this.layout.layout().view);
  protected readonly viewOptions: readonly SelectOption[] = Object.values(OrganizationViewMode).map(t => new SelectOption(t, Resources.organizationViewLabels[t]));
  protected readonly thread: OrganizationMessagesShape = OrganizationMessagesShape.Thread;
  protected readonly focusKey: Signal<string | null> = computed(() => this.layout.layout().focus);
  protected readonly chosen: WritableSignal<OrganizationTarget | null> = linkedSignal<string | null, OrganizationTarget | null>({ source: this.focusKey, computation: () => null });
  protected readonly tree: Signal<readonly OrganizationNode[]> = computed(() => OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()));
  protected readonly directReports: Signal<readonly Teammate[]> = computed(() =>
    OrganizationNode.directReportsOf(this.organization.organization(), this.store.teammates()));
  protected readonly headcount: Signal<string> = computed(() =>
    Resources.formatOrganizationHeadcount(this.store.teammates().length - this.organization.organization().unplaced(this.store.teammates().map(t => t.id)).length,
      OrganizationNode.departmentsOf(this.organization.organization()).length));
  protected readonly target: Signal<OrganizationTarget | null> = computed(() => {
    const first = this.tree()[0];
    const key = this.focusKey();
    return this.chosen() ?? (Object.isNull(key) ? null : OrganizationFocus.resolve(this.tree(), this.directReports(), key).target)
      ?? (Object.isUndefined(first) ? null : OrganizationTarget.department(first.id));
  });
  protected readonly choices: Signal<readonly OrganizationTargetChoice[]> = computed(() => OrganizationTargetChoice.of(this.tree(), this.directReports()));
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => this.choices().map(t => new SelectOption(t.key, t.label)));
  protected readonly targetKey: Signal<string> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? String.empty : OrganizationConversation.keyOf(target);
  });
  protected readonly ownerRole: Signal<string> = computed(() => Resources.formatOrganizationOwnerRole(this.tree().filter(t => !Object.isNull(t.leader)).length
    + this.directReports().length));

  protected showView(value: string): void {
    this.layout.showView(OrganizationLayout.viewOf(value));
  }

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
