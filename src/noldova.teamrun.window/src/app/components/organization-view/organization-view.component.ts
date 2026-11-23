/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, DestroyRef, effect, inject, input, type InputSignal, signal, type Signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

import { OrganizationParent, OrganizationTarget, type Teammate } from "@noldova/teamrun.protocol";

import { AvatarComponent, ButtonComponent, ButtonVariant, CanvasComponent, CanvasFitAlignment, CanvasItemDirective, ColorChoices, DialogService, MenuComponent,
  MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, SelectComponent,
  SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { FlowLineShape } from "../../enums/flow-line-shape";
import { OrganizationTargetKey } from "../../models/organization-target-key";
import { OrganizationTargetChoice } from "../../models/organization-target-choice";
import { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationFlowService } from "../../services/organization-flow.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationScope } from "../../services/organization-scope";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { OrganizationUnitSelection } from "../../services/organization-unit-selection";
import { FlowOverlayComponent } from "../flow-overlay/flow-overlay.component";
import { OrganizationDepartmentComponent } from "../organization-department/organization-department.component";
import { OrganizationDepartmentDialogComponent } from "../organization-department-dialog/organization-department-dialog.component";
import { OrganizationDropDirective } from "../organization-drop.directive";
import { OrganizationChatComponent } from "../organization-chat/organization-chat.component";
import { OrganizationAddTeammateDirective } from "../organization-add-teammate.directive";
import { OrganizationTypesDialogComponent } from "../organization-types-dialog/organization-types-dialog.component";
import { OrganizationUnitEditorComponent } from "../organization-unit-editor/organization-unit-editor.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";

@Component({
  selector: "nol-teamrun-organization-view",
  imports: [AvatarComponent, ButtonComponent, CanvasComponent, CanvasItemDirective, FlowOverlayComponent, MenuComponent, MenuGroupComponent,
    MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, NgTemplateOutlet, OrganizationChatComponent, OrganizationDepartmentComponent,
    OrganizationDropDirective, OrganizationAddTeammateDirective, OrganizationUnitEditorComponent, SelectComponent, TeammateStatusComponent],
  providers: [ChatStoreService.provider, OrganizationScope.provider, OrganizationStoreService.provider, OrganizationLayoutService.provider,
    OrganizationFlowService.provider, OrganizationUnitSelection.provider],
  host: { class: "nol-teamrun-organization-view", "(pointerdown)": "markInView()", "(focusin)": "markInView()" },
  templateUrl: "./organization-view.component.html",
  styleUrls: ["../organization-tree.css", "./organization-view.component.css"]
})
export class OrganizationViewComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly instance: InputSignal<string> = input<string>(Resources.organizationDocumentInstance);

  protected readonly resources: typeof Resources = Resources;
  protected readonly lines: typeof FlowLineShape = FlowLineShape;
  protected readonly flows: OrganizationFlowService = inject(OrganizationFlowService);
  protected readonly person: OrganizationParent = OrganizationParent.person;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly top: CanvasFitAlignment = CanvasFitAlignment.Top;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly editing: WritableSignal<boolean> = signal(false);
  protected readonly selection: OrganizationUnitSelection = inject(OrganizationUnitSelection);
  protected readonly chosen: WritableSignal<OrganizationTarget | null> = signal(null);
  protected readonly root: Signal<OrganizationNode> = computed(() => OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()));
  protected readonly editedUnit: Signal<OrganizationNode | null> = computed(() => {
    const id = this.selection.unitId();
    return Object.isNull(id) ? null : OrganizationNode.walk(this.root()).find(t => t.department?.id === id) ?? null;
  });
  protected readonly flowColors: Signal<ReadonlyMap<string, string>> = computed(() => {
    const colors = new Map<string, string>();
    for (const node of OrganizationNode.walk(this.root()).filter(t => !Object.isNull(t.department))) {
      const color = ColorChoices.toCss(node.type?.color ?? null);
      if (!Object.isNull(color))
        for (const key of [Resources.formatOrganizationFlowDepartmentKey(node.id), ...node.leader === null ? [] : [node.leader.id], ...node.members.map(t => t.id)])
          colors.set(key, color);
    }
    return colors;
  });
  protected readonly reports: Signal<readonly Teammate[]> = computed(() => this.root().members);
  protected readonly headcount: Signal<string> = computed(() =>
    Resources.formatOrganizationHeadcount(this.store.teammates().length - this.organization.organization().unplaced(this.store.teammates().map(t => t.id)).length,
      OrganizationNode.departmentsOf(this.organization.organization()).length));
  protected readonly target: Signal<OrganizationTarget | null> = computed(() => {
    const first = OrganizationNode.walk(this.root()).flatMap(t => t.department ?? [])[0];
    return this.chosen() ?? (Object.isUndefined(first) ? null : OrganizationTarget.department(first.id));
  });
  protected readonly choices: Signal<readonly OrganizationTargetChoice[]> = computed(() => OrganizationTargetChoice.of(this.root().subDepartments,
    [...this.root().directReports, ...this.reports().filter(t => this.root().managers.has(t.id))]));
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => this.choices().map(t => new SelectOption(t.key, t.label)));
  protected readonly targetKey: Signal<string> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? String.empty : OrganizationTargetKey.of(target);
  });

  protected readonly ownerRole: Signal<string> = computed(() => Resources.formatOrganizationOwnerRole(this.root().departments.filter(t => !Object.isNull(t.leader)).length
    + this.root().reports.length));

  public constructor() {
    inject(OrganizationScope).follow(this.instance);
    const context: IWindowPartContext = inject(WindowPartTokens.context);
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    const chats: ChatStoreService = inject(ChatStoreService);
    effect(() => {
      const instance = this.instance();
      const isActive = active();
      untracked(() => chats.showOrganization(instance, isActive));
    });
    inject(DestroyRef).onDestroy(() => chats.showOrganization(this.instance(), false));
    effect(() => {
      const organization = this.organization.organization();
      if (organization.id === this.instance() && organization.updatedAt !== Resources.organizationUnloadedTime)
        untracked(() => context.updateDocument(Resources.organizationDocumentName, organization.id, { title: organization.name }));
    });
  }

  protected markInView(): void {
    this.store.showOrganization(this.instance(), true);
  }

  protected toggleEditing(): void {
    this.editing.update(t => !t);
    this.selection.select(null);
  }

  protected openTypes(): void {
    OrganizationTypesDialogComponent.open(this.dialogs, this.organization);
  }

  protected addDepartment(): void {
    OrganizationDepartmentDialogComponent.open(this.dialogs, this.store, this.organization, OrganizationParent.person);
  }

  protected pick(key: string): void {
    const found = this.choices().find(t => t.key === key);
    if (!Object.isUndefined(found))
      this.chosen.set(found.target);
  }
}
