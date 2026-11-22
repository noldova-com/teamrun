/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";

import { WindowPartTokens } from "@noldova/desktop.window";
import { type Department, OrganizationParent, OrganizationTarget, type Teammate } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CanvasComponent, CanvasFitAlignment, CanvasItemDirective, ChipComponent, DialogService, IconButtonComponent, MenuComponent, MenuItemComponent,
  MenuTriggerDirective, OverlayAlignment, OverlaySide, PopoverOpening, PopoverTriggerDirective, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import { TeammateStatus } from "../../enums/teammate-status";
import { OrganizationBoardAsk } from "../../models/organization-board-ask";
import { OrganizationCrumb } from "../../models/organization-crumb";
import { ConfirmRequest } from "../../models/confirm-request";
import { OrganizationTargetKey } from "../../models/organization-target-key";
import { OrganizationEdits } from "../../models/organization-edits";
import { OrganizationFocus } from "../../models/organization-focus";
import type { OrganizationNode } from "../../models/organization.node";
import { OrganizationOutlineRow } from "../../models/organization-outline-row";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";
import { OrganizationChatComponent } from "../organization-chat/organization-chat.component";
import { OrganizationDepartmentDialogComponent } from "../organization-department-dialog/organization-department-dialog.component";
import { OrganizationDetailsComponent } from "../organization-details/organization-details.component";
import { OrganizationTypeChoiceComponent } from "../organization-type-choice/organization-type-choice.component";
import { OrganizationTypeIconComponent } from "../organization-type-icon/organization-type-icon.component";

@Component({
  selector: "nol-teamrun-organization-focus",
  imports: [ButtonComponent, CanvasComponent, CanvasItemDirective, ChipComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, OrganizationCardComponent,
    OrganizationChatComponent, OrganizationDetailsComponent, OrganizationTypeChoiceComponent, OrganizationTypeIconComponent, PopoverTriggerDirective, TextFieldComponent],
  host: { class: "nol-teamrun-organization-focus" },
  templateUrl: "./organization-focus.component.html",
  styleUrl: "./organization-focus.component.css"
})
export class OrganizationFocusComponent {
  private readonly statuses: TeammateStatusStoreService = TeammateStatusStoreService.of(inject(WindowPartTokens.context));

  private readonly chats: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly tree: InputSignal<readonly OrganizationNode[]> = input.required<readonly OrganizationNode[]>();
  public readonly reports: InputSignal<readonly Teammate[]> = input<readonly Teammate[]>([]);
  public readonly managers: InputSignal<ReadonlyMap<string, Teammate>> = input<ReadonlyMap<string, Teammate>>(new Map<string, Teammate>());
  public readonly editing: InputSignal<boolean> = input<boolean>(false);

  protected readonly resources: typeof Resources = Resources;
  protected readonly fluid: OrganizationCardShape = OrganizationCardShape.Fluid;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly top: CanvasFitAlignment = CanvasFitAlignment.Top;
  protected readonly detailsOpening: PopoverOpening = PopoverOpening.Hover;
  protected readonly detailsSide: OverlaySide = OverlaySide.below;
  protected readonly detailsAlignment: OverlayAlignment = OverlayAlignment.Start;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly rows: Signal<readonly OrganizationOutlineRow[]> = computed(() => OrganizationFocusComponent.flatten(this.tree(), 0));
  protected readonly headcount: Signal<number> = computed(() => this.rows().reduce((total, t) => total + t.node.headcount, this.reports().length));
  protected readonly focus: Signal<OrganizationFocus> = computed(() => OrganizationFocus.resolve(this.tree(), this.reports(), this.layout.layout().focus));
  protected readonly unit: Signal<OrganizationNode | null> = computed(() => Object.isNull(this.focus().teammate) ? this.focus().department : null);
  protected readonly removable: Signal<boolean> = computed(() => {
    const focus = this.focus();
    return Object.isNull(focus.teammate) || focus.department?.leader?.id !== focus.teammate.id;
  });
  protected readonly key: Signal<string> = computed(() => OrganizationTargetKey.of(this.focus().target));
  protected readonly departmentNames: Signal<ReadonlyMap<string, string>> = computed(() => {
    const names = new Map<string, string>();
    for (const person of this.reports())
      names.set(person.id, this.reportsToOf(person) ?? Resources.organizationReportsToYou);
    for (const row of this.rows())
      for (const person of row.people)
        names.set(person.id, row.node.name);
    return names;
  });
  protected readonly leaders: Signal<readonly Teammate[]> = computed(() => this.rows().flatMap(t => Object.isNull(t.node.leader) ? [] : [t.node.leader]));
  protected readonly cards: Signal<readonly Teammate[]> = computed(() => {
    const focus = this.focus();
    if (!Object.isNull(focus.teammate))
      return [focus.teammate];
    const department = focus.department;
    return Object.isNull(department) ? [...this.leaders(), ...this.reports()] : [...Object.isNull(department.leader) ? [] : [department.leader], ...department.members];
  });
  protected readonly crumbs: Signal<readonly OrganizationCrumb[]> = computed(() => {
    const focus = this.focus();
    const here = this.key();
    const trail = [new OrganizationCrumb(Resources.organizationTitle, OrganizationTarget.leaders, false), ...focus.path.map(t => new OrganizationCrumb(t.name, OrganizationTarget.department(t.id), false)),
      ...Object.isNull(focus.teammate) ? [] : [new OrganizationCrumb(focus.teammate.name, OrganizationTarget.teammate(focus.teammate.id), false)]];
    return trail.map(t => new OrganizationCrumb(t.label, t.target, OrganizationTargetKey.of(t.target) === here));
  });
  protected readonly unitName: Signal<string> = computed(() => this.focus().teammate?.name ?? this.focus().department?.name ?? Resources.organizationTitle);
  protected readonly unitSummary: Signal<string> = computed(() => {
    const focus = this.focus();
    const department = focus.department;
    if (!Object.isNull(focus.teammate))
      return Resources.formatOrganizationFocusTeammate(focus.teammate.role, this.reportsToOf(focus.teammate) ?? focus.departmentName, focus.teammate.model);
    const counts = this.countsOf(this.cards());
    const under = this.cards().filter(t => this.managers().has(t.id)).length;
    return Object.isNull(department) ? Resources.formatOrganizationFocusLeaders(this.cards().length - under, counts, under)
      : Resources.formatOrganizationFocusDepartment(this.cards().length, counts);
  });

  protected reportsToOf(teammate: Teammate): string | null {
    const manager = this.managers().get(teammate.id);
    return Object.isUndefined(manager) ? null : Resources.formatOrganizationReportsTo(manager.name);
  }

  protected addable(row: OrganizationOutlineRow): readonly Teammate[] {
    return OrganizationEdits.addable(row.node, this.chats.teammates());
  }

  protected addMember(row: OrganizationOutlineRow, teammate: Teammate): void {
    void this.organization.setMember(teammate.id, row.node.id);
  }

  protected addDepartment(): void {
    OrganizationDepartmentDialogComponent.open(this.dialogs, this.chats, this.organization, OrganizationParent.person);
  }

  protected rename(department: Department, event: Event): void {
    void OrganizationEdits.renameAsync(event, department.name, name => this.organization.renameDepartment(department.id, name));
  }

  protected removeTeammate(teammate: Teammate, department: Department): void {
    this.confirm(new ConfirmRequest(Resources.organizationRemoveMemberTitle, Resources.formatOrganizationRemoveMember(teammate.name, department.name),
      Resources.organizationRemoveLabel, null, true), () => {
      this.go(OrganizationTarget.department(department.id));
      void this.organization.setMember(teammate.id, null);
    });
  }

  protected departmentOf(teammate: Teammate): Department | null {
    const node = this.focus().department;
    return !Object.isNull(node) && node.members.some(t => t.id === teammate.id) ? node.department : null;
  }

  protected deleteDepartment(department: Department): void {
    this.confirm(OrganizationEdits.deleteRequest(department, this.organization.organization().typeOf(department.id),
      [...this.rows().map(t => t.node), ...this.chats.teammates()]), () => void this.organization.deleteDepartment(department.id));
  }

  private confirm(request: ConfirmRequest, action: () => void): void {
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", request);
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        action();
    });
  }

  protected status(teammate: Teammate): TeammateStatus {
    return this.statuses.statusOf(teammate.id)();
  }

  protected asksIn(row: OrganizationOutlineRow): number {
    return row.people.filter(t => OrganizationBoardAsk.needsYou(this.status(t))).length;
  }

  protected isHere(target: OrganizationTarget): boolean {
    return OrganizationTargetKey.of(target) === this.key();
  }

  protected go(target: OrganizationTarget): void {
    this.layout.focusOn(OrganizationTargetKey.of(target));
  }

  protected department(row: OrganizationOutlineRow): OrganizationTarget {
    return OrganizationTarget.department(row.node.id);
  }

  protected open(row: OrganizationOutlineRow): void {
    this.go(this.department(row));
  }

  protected teammate(teammate: Teammate): OrganizationTarget {
    return OrganizationTarget.teammate(teammate.id);
  }

  protected rootTarget(): OrganizationTarget {
    return OrganizationTarget.leaders;
  }

  private countsOf(teammates: readonly Teammate[]): ReadonlyMap<TeammateStatus, number> {
    const counts = new Map<TeammateStatus, number>();
    for (const teammate of teammates)
      counts.set(this.status(teammate), (counts.get(this.status(teammate)) ?? 0) + 1);
    return counts;
  }

  private static flatten(nodes: readonly OrganizationNode[], depth: number): readonly OrganizationOutlineRow[] {
    return nodes.flatMap(t => [new OrganizationOutlineRow(t, depth), ...OrganizationFocusComponent.flatten(t.subDepartments, depth + 1)]);
  }
}
