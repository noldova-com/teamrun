/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, output, type OutputEmitterRef, type Signal, signal, type WritableSignal } from "@angular/core";

import { WindowPartTokens } from "@noldova/desktop.window";
import type { Teammate } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, CanvasItemDirective, ChipComponent, ChoicePillsComponent, DialogService, IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective,
  SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationBoardSort } from "../../enums/organization-board-sort";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import { TeammateStatus } from "../../enums/teammate-status";
import type { ConfirmRequest } from "../../models/confirm-request";
import { OrganizationBoardAsk } from "../../models/organization-board-ask";
import { OrganizationEdits } from "../../models/organization-edits";
import type { OrganizationNode } from "../../models/organization-node";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { OrganizationCardComponent } from "../organization-card/organization-card.component";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";
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

  public readonly tree: InputSignal<readonly OrganizationNode[]> = input.required<readonly OrganizationNode[]>();
  public readonly editing: InputSignal<boolean> = input<boolean>(false);
  public readonly messageLeaders: OutputEmitterRef<void> = output<void>();
  public readonly messageDepartment: OutputEmitterRef<string> = output<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly row: OrganizationCardShape = OrganizationCardShape.Row;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  protected readonly sortOptions: readonly SelectOption[] = Object.values(OrganizationBoardSort).map(t => new SelectOption(t, Resources.organizationBoardSortLabels[t]));
  protected readonly departments: Signal<readonly OrganizationNode[]> = computed(() => OrganizationBoardComponent.flatten(this.tree()));
  protected readonly leaders: Signal<readonly Teammate[]> = computed(() => this.departments().flatMap(t => Object.isNull(t.leader) ? [] : [t.leader]));
  protected readonly asks: Signal<readonly OrganizationBoardAsk[]> = computed(() => OrganizationBoardAsk.byStatus(this.departments()
    .flatMap(node => [...Object.isNull(node.leader) ? [] : [node.leader], ...node.members].map(t => new OrganizationBoardAsk(t, node.department.name, this.status(t))))
    .filter(t => OrganizationBoardAsk.needsYou(t.status)), t => t.status));

  protected status(teammate: Teammate): TeammateStatus {
    return this.statuses.statusOf(teammate.id)();
  }

  protected sortOf(node: OrganizationNode): OrganizationBoardSort {
    return this.sorts().get(node.department.id) ?? OrganizationBoardSort.Status;
  }

  protected sort(node: OrganizationNode, value: string): void {
    const sort = Object.values(OrganizationBoardSort).find(t => t === value) ?? OrganizationBoardSort.Status;
    this.sorts.update(t => new Map([...t, [node.department.id, sort]]));
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

  protected rename(node: OrganizationNode, event: Event): void {
    const name = OrganizationEdits.nameOf(event);
    if (name.length > 0 && name !== node.department.name)
      void this.organization.renameDepartment(node.department.id, name);
  }

  protected addMember(node: OrganizationNode, teammate: Teammate): void {
    void this.organization.setMember(teammate.id, node.department.id);
  }

  protected addDepartment(): void {
    void this.organization.createDepartment(Resources.organizationNewDepartment, null);
  }

  protected answer(ask: OrganizationBoardAsk): void {
    const chatId = ask.isAnswer ? this.statuses.activitiesOf(ask.teammate.id)().at(0)?.chatId : undefined;
    if (Object.isString(chatId)) {
      this.chats.showChatPage(chatId);
      return;
    }
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.chats);
    dialog.componentRef?.setInput("teammate", ask.teammate);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected deleteDepartment(node: OrganizationNode): void {
    this.confirm(OrganizationEdits.deleteRequest(node, this.departments()), () => void this.organization.deleteDepartment(node.department.id));
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
