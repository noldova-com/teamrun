/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";

import { WindowPartTokens } from "@noldova/desktop.window";
import { type Department, OrganizationTarget, type Teammate, TeammateUpdateParams } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CanvasComponent, CanvasFitAlignment, CanvasItemDirective, ChipComponent, DialogService, IconButtonComponent, MenuComponent, MenuItemComponent,
  MenuTriggerDirective, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import { OrganizationMessagesShape } from "../../enums/organization-messages-shape";
import { TeammateStatus } from "../../enums/teammate-status";
import { OrganizationBoardAsk } from "../../models/organization-board-ask";
import { OrganizationCrumb } from "../../models/organization-crumb";
import { ConfirmRequest } from "../../models/confirm-request";
import { OrganizationConversation } from "../../models/organization-conversation";
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
import { OrganizationMessagesComponent } from "../organization-messages/organization-messages.component";

@Component({
  selector: "nol-teamrun-organization-focus",
  imports: [ButtonComponent, CanvasComponent, CanvasItemDirective, ChipComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, OrganizationCardComponent,
    OrganizationMessagesComponent, TextFieldComponent],
  host: { class: "nol-teamrun-organization-focus" },
  templateUrl: "./organization-focus.component.html",
  styleUrl: "./organization-focus.component.css"
})
export class OrganizationFocusComponent {
  private readonly statuses: TeammateStatusStoreService = TeammateStatusStoreService.of(inject(WindowPartTokens.context));

  private readonly chats: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly tree: InputSignal<readonly OrganizationNode[]> = input.required<readonly OrganizationNode[]>();
  public readonly editing: InputSignal<boolean> = input<boolean>(false);

  protected readonly resources: typeof Resources = Resources;
  protected readonly fluid: OrganizationCardShape = OrganizationCardShape.Fluid;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly top: CanvasFitAlignment = CanvasFitAlignment.Top;
  protected readonly thread: OrganizationMessagesShape = OrganizationMessagesShape.Thread;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly rows: Signal<readonly OrganizationOutlineRow[]> = computed(() => OrganizationFocusComponent.flatten(this.tree(), 0));
  protected readonly headcount: Signal<number> = computed(() => this.rows().reduce((total, t) => total + t.node.headcount, 0));
  protected readonly focus: Signal<OrganizationFocus> = computed(() => OrganizationFocus.resolve(this.tree(), this.layout.layout().focus));
  protected readonly unit: Signal<OrganizationNode | null> = computed(() => Object.isNull(this.focus().teammate) ? this.focus().department : null);
  protected readonly removable: Signal<boolean> = computed(() => {
    const focus = this.focus();
    return Object.isNull(focus.teammate) || focus.department?.leader?.id !== focus.teammate.id;
  });
  protected readonly key: Signal<string> = computed(() => OrganizationConversation.keyOf(this.focus().target));
  protected readonly departmentNames: Signal<ReadonlyMap<string, string>> = computed(() =>
    new Map(this.rows().flatMap(row => row.people.map((person): [string, string] => [person.id, row.node.department.name]))));
  protected readonly leaders: Signal<readonly Teammate[]> = computed(() => this.rows().flatMap(t => Object.isNull(t.node.leader) ? [] : [t.node.leader]));
  protected readonly cards: Signal<readonly Teammate[]> = computed(() => {
    const focus = this.focus();
    if (!Object.isNull(focus.teammate))
      return [focus.teammate];
    const department = focus.department;
    return Object.isNull(department) ? this.leaders() : [...Object.isNull(department.leader) ? [] : [department.leader], ...department.members];
  });
  protected readonly crumbs: Signal<readonly OrganizationCrumb[]> = computed(() => {
    const focus = this.focus();
    const here = this.key();
    const trail = [new OrganizationCrumb(Resources.organizationTitle, OrganizationTarget.leaders, false), ...focus.path.map(t => new OrganizationCrumb(t.department.name, OrganizationTarget.department(t.department.id), false)),
      ...Object.isNull(focus.teammate) ? [] : [new OrganizationCrumb(focus.teammate.name, OrganizationTarget.teammate(focus.teammate.id), false)]];
    return trail.map(t => new OrganizationCrumb(t.label, t.target, OrganizationConversation.keyOf(t.target) === here));
  });
  protected readonly unitName: Signal<string> = computed(() => this.focus().teammate?.name ?? this.focus().department?.department.name ?? Resources.organizationTitle);
  protected readonly unitSummary: Signal<string> = computed(() => {
    const focus = this.focus();
    const department = focus.department;
    if (!Object.isNull(focus.teammate))
      return Resources.formatOrganizationFocusTeammate(focus.teammate.role, focus.departmentName, focus.teammate.model);
    const counts = this.countsOf(this.cards());
    return Object.isNull(department) ? Resources.formatOrganizationFocusLeaders(this.cards().length, counts) : Resources.formatOrganizationFocusDepartment(this.cards().length, counts);
  });

  protected addable(row: OrganizationOutlineRow): readonly Teammate[] {
    return OrganizationEdits.addable(row.node, this.chats.teammates());
  }

  protected addMember(row: OrganizationOutlineRow, teammate: Teammate): void {
    void this.organization.setMember(teammate.id, row.node.department.id);
  }

  protected addDepartment(): void {
    void this.organization.createDepartment(Resources.organizationNewDepartment, null);
  }

  protected rename(node: OrganizationNode, event: Event): void {
    void OrganizationEdits.renameAsync(event, node.department.name, name => this.organization.renameDepartment(node.department.id, name));
  }

  protected renameTeammate(teammate: Teammate, event: Event): void {
    this.organization.clearActionError();
    void OrganizationEdits.renameAsync(event, teammate.name, async name => {
      let params: TeammateUpdateParams | null;
      try {
        params = TeammateUpdateParams.changing(teammate, { name });
      }
      catch {
        this.organization.fail(Resources.organizationTeammateNameRule);
        return false;
      }
      return this.chats.updateTeammate(teammate.id, params, message => this.organization.fail(message));
    });
  }

  protected removeTeammate(teammate: Teammate, node: OrganizationNode): void {
    this.confirm(new ConfirmRequest(Resources.organizationRemoveMemberTitle, Resources.formatOrganizationRemoveMember(teammate.name, node.department.name),
      Resources.organizationRemoveLabel, null, true), () => {
      this.go(OrganizationTarget.department(node.department.id));
      void this.organization.setMember(teammate.id, null);
    });
  }

  protected departmentOf(teammate: Teammate): Department | null {
    const node = this.focus().department;
    return !Object.isNull(node) && node.members.some(t => t.id === teammate.id) ? node.department : null;
  }

  protected deleteDepartment(node: OrganizationNode): void {
    this.confirm(OrganizationEdits.deleteRequest(node, this.rows().map(t => t.node)), () => void this.organization.deleteDepartment(node.department.id));
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
    return OrganizationConversation.keyOf(target) === this.key();
  }

  protected go(target: OrganizationTarget): void {
    this.layout.focusOn(OrganizationConversation.keyOf(target));
  }

  protected department(row: OrganizationOutlineRow): OrganizationTarget {
    return OrganizationTarget.department(row.node.department.id);
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
    return nodes.flatMap(t => [new OrganizationOutlineRow(t, depth), ...OrganizationFocusComponent.flatten(t.children, depth + 1)]);
  }
}
