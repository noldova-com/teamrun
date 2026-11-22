/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, type InputSignal, input, output, type OutputEmitterRef, type Signal, signal, untracked, type WritableSignal } from "@angular/core";

import { WindowPartTokens } from "@noldova/desktop.window";
import { type Department, OrganizationTarget, type Teammate } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CanvasItemDirective, ChipComponent, ChoicePillsComponent, DialogService, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective,
  SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationBoardSort } from "../../enums/organization-board-sort";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import { TeammateStatus } from "../../enums/teammate-status";
import type { ConfirmRequest } from "../../models/confirm-request";
import { OrganizationBoardAsk } from "../../models/organization-board-ask";
import { OrganizationTargetKey } from "../../models/organization-target-key";
import { OrganizationEdits } from "../../models/organization-edits";
import type { OrganizationNode } from "../../models/organization.node";
import { ChatStoreService } from "../../services/chat-store.service";
import { ClockService } from "../../services/clock.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";

@Component({
  selector: "nol-teamrun-organization-board",
  imports: [ButtonComponent, CanvasItemDirective, ChipComponent, ChoicePillsComponent, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, OrganizationCardComponent,
    TeammateAvatarComponent, TeammateStatusComponent, TextFieldComponent],
  host: { class: "nol-teamrun-organization-board" },
  templateUrl: "./organization-board.component.html",
  styleUrl: "./organization-board.component.css"
})
export class OrganizationBoardComponent {
  private readonly chats: ChatStoreService = inject(ChatStoreService);
  private readonly statuses: TeammateStatusStoreService = TeammateStatusStoreService.of(inject(WindowPartTokens.context));
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly sorts: WritableSignal<ReadonlyMap<string, OrganizationBoardSort>> = signal(new Map());
  private readonly clock: ClockService = inject(ClockService);
  private readonly time: WritableSignal<number> = signal(this.clock.now());

  public readonly tree: InputSignal<readonly OrganizationNode[]> = input.required<readonly OrganizationNode[]>();
  public readonly directReports: InputSignal<readonly Teammate[]> = input<readonly Teammate[]>([]);
  public readonly editing: InputSignal<boolean> = input<boolean>(false);
  public readonly target: InputSignal<OrganizationTarget | null> = input<OrganizationTarget | null>(null);
  public readonly chosen: OutputEmitterRef<OrganizationTarget> = output<OrganizationTarget>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly row: OrganizationCardShape = OrganizationCardShape.Row;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly sortOptions: readonly SelectOption[] = Object.values(OrganizationBoardSort).map(t => new SelectOption(t, Resources.organizationBoardSortLabels[t]));
  protected readonly departments: Signal<readonly OrganizationNode[]> = computed(() => OrganizationBoardComponent.flatten(this.tree()));
  protected readonly leaders: Signal<readonly Teammate[]> = computed(() => this.departments().flatMap(t => Object.isNull(t.leader) ? [] : [t.leader]));
  protected readonly asks: Signal<readonly OrganizationBoardAsk[]> = computed(() => OrganizationBoardAsk.byStatus([
    ...this.directReports().map(t => new OrganizationBoardAsk(t, Resources.organizationReportsToYou, this.status(t))),
    ...this.departments().flatMap(node => [...Object.isNull(node.leader) ? [] : [node.leader], ...node.members].map(t => new OrganizationBoardAsk(t, node.name, this.status(t))))
  ].filter(t => OrganizationBoardAsk.needsYou(t.status)), t => t.status));
  protected readonly targetKey: Signal<string | null> = computed(() => {
    const target = this.target();
    return Object.isNull(target) ? null : OrganizationTargetKey.of(target);
  });
  protected readonly leadersTarget: OrganizationTarget = OrganizationTarget.leaders;

  public constructor() {
    effect(onCleanup => {
      untracked(() => this.time.set(this.clock.now()));
      onCleanup(this.clock.every(Resources.clockIntervalMilliseconds, () => this.time.set(this.clock.now())));
    });
  }

  protected isOpen(target: OrganizationTarget): boolean {
    return this.targetKey() === OrganizationTargetKey.of(target);
  }

  protected teammateTarget(teammate: Teammate): OrganizationTarget {
    return OrganizationTarget.teammate(teammate.id);
  }

  protected departmentTarget(node: OrganizationNode): OrganizationTarget {
    return OrganizationTarget.department(node.id);
  }

  protected askAgo(ask: OrganizationBoardAsk): string | null {
    const reply = this.statuses.lastReplyOf(ask.teammate.id)();
    return Object.isNull(reply) ? null : Resources.formatOrganizationBoardAskAgo(Date.parse(reply.endedAt), this.time());
  }

  protected askText(ask: OrganizationBoardAsk): string | null {
    return this.statuses.lastReplyOf(ask.teammate.id)()?.text ?? null;
  }

  protected status(teammate: Teammate): TeammateStatus {
    return this.statuses.statusOf(teammate.id)();
  }

  protected sortOf(node: OrganizationNode): OrganizationBoardSort {
    return this.sorts().get(node.id) ?? OrganizationBoardSort.Status;
  }

  protected sort(node: OrganizationNode, value: string): void {
    const sort = Object.values(OrganizationBoardSort).find(t => t === value) ?? OrganizationBoardSort.Status;
    this.sorts.update(t => new Map([...t, [node.id, sort]]));
  }

  protected membersOf(node: OrganizationNode): readonly Teammate[] {
    return this.sortOf(node) === OrganizationBoardSort.Name ? node.members : OrganizationBoardAsk.byStatus(node.members, t => this.status(t));
  }

  protected summaryOf(node: OrganizationNode): string {
    const counts = new Map<TeammateStatus, number>();
    for (const teammate of [...Object.isNull(node.leader) ? [] : [node.leader], ...node.members])
      counts.set(this.status(teammate), (counts.get(this.status(teammate)) ?? 0) + 1);
    return Resources.formatOrganizationBoardSummary(node.leader?.name ?? null, counts);
  }

  protected addable(node: OrganizationNode): readonly Teammate[] {
    return OrganizationEdits.addable(node, this.chats.teammates());
  }

  protected rename(department: Department, event: Event): void {
    void OrganizationEdits.renameAsync(event, department.name, name => this.organization.renameDepartment(department.id, name));
  }

  protected addMember(node: OrganizationNode, teammate: Teammate): void {
    void this.organization.setMember(teammate.id, node.id);
  }

  protected addDepartment(): void {
    void this.organization.createDepartment(Resources.organizationNewDepartment, null);
  }

  protected deleteDepartment(department: Department): void {
    this.confirm(OrganizationEdits.deleteRequest(department, this.departments()), () => void this.organization.deleteDepartment(department.id));
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

  private static flatten(nodes: readonly OrganizationNode[]): readonly OrganizationNode[] {
    return nodes.flatMap(t => [t, ...OrganizationBoardComponent.flatten(t.children)]);
  }
}
