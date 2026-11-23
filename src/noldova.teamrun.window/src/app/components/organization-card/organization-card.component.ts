/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, type InputSignal, input, output, type OutputEmitterRef, type Signal, signal, untracked, type WritableSignal } from "@angular/core";

import { WindowPartTokens } from "@noldova/desktop.window";
import { type Conversation, type Department, OrganizationParent, type Project, type Teammate, type TeammateLastReply } from "@noldova/teamrun.protocol";
import { DialogService, IconButtonComponent, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective,
  MeterComponent, PopoverTriggerDirective, SelectComponent, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationCardField } from "../../enums/organization-card-field";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import { TeammateStatus } from "../../enums/teammate-status";
import { ConfirmRequest } from "../../models/confirm-request";
import { OrganizationCardNow } from "../../models/organization-card-now";
import { OrganizationCardUsage } from "../../models/organization-card-usage";
import { OrganizationPlaceChoice } from "../../models/organization-place-choice";
import { OrganizationRunningReply } from "../../models/organization-running-reply";
import { OrganizationNode } from "../../models/organization.node";
import { ChatPlacement } from "../../services/chat-placement";
import { ChatStoreService } from "../../services/chat-store.service";
import { ClockService } from "../../services/clock.service";
import { ConversationActions } from "../../services/conversation-actions";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { ProjectsLayoutService } from "../../services/projects-layout.service";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";
import { TeammateWorkComponent } from "../teammate-work/teammate-work.component";

@Component({
  selector: "nol-teamrun-organization-card",
  imports: [IconButtonComponent, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, MeterComponent,
    SelectComponent, TeammateAvatarComponent, TeammateStatusComponent, TeammateWorkComponent],
  providers: [ChatStoreService.provider, OrganizationLayoutService.provider, OrganizationStoreService.provider, ProjectsLayoutService.provider,
    TeammateStatusStoreService.provider],
  host: { "class": "nol-teamrun-organization-card", "[class.fluid]": "shape() === shapes.Fluid", "[class.row]": "shape() === shapes.Row", "(focusin)": "closeDetails($event)" },
  templateUrl: "./organization-card.component.html",
  styleUrl: "./organization-card.component.css"
})
export class OrganizationCardComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: UsageFormatterService = inject(UsageFormatterService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly placement: ChatPlacement = new ChatPlacement(inject(WindowPartTokens.context), this.store, this.dialogs);
  private readonly statuses: TeammateStatusStoreService = inject(TeammateStatusStoreService);
  private readonly clock: ClockService = inject(ClockService);
  private readonly projectsLayout: ProjectsLayoutService = inject(ProjectsLayoutService);
  private readonly time: WritableSignal<number> = signal(this.clock.now());
  private readonly details: PopoverTriggerDirective | null = inject(PopoverTriggerDirective, { self: true, optional: true });

  public readonly teammate: InputSignal<Teammate> = input.required<Teammate>();
  public readonly shape: InputSignal<OrganizationCardShape> = input<OrganizationCardShape>(OrganizationCardShape.Card);
  public readonly editing: InputSignal<boolean> = input(false);
  public readonly department: InputSignal<Department | null> = input<Department | null>(null);
  public readonly departmentName: InputSignal<string | undefined> = input<string | undefined>(undefined);
  public readonly reportsTo: InputSignal<string | null> = input<string | null>(null);
  public readonly message: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly fieldNames: typeof OrganizationCardField = OrganizationCardField;
  protected readonly shapes: typeof OrganizationCardShape = OrganizationCardShape;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly fields: Signal<ReadonlySet<OrganizationCardField>> = computed(() => this.layout.layout().fieldsOf(this.teammate().id));
  protected readonly showsWork: Signal<boolean> = computed(() => Resources.organizationWorkFields.some(t => this.fields().has(t)));
  protected readonly usage: Signal<OrganizationCardUsage | null> = computed(() => {
    const plan = this.store.planUsageOfProvider(this.teammate().providerId);
    for (const meter of Object.isNull(plan) ? [] : this.formatter.limitsOf(plan))
      if (!Object.isNull(meter.percent))
        return new OrganizationCardUsage(meter, (Resources.wholePercent - meter.percent) / Resources.wholePercent);
    return null;
  });
  protected readonly model: Signal<string | null> = computed(() => {
    const teammate = this.teammate();
    return Object.isNull(teammate.model) ? null : Resources.formatOrganizationModel(teammate.model, teammate.effort);
  });

  protected readonly now: Signal<OrganizationCardNow> = computed(() => {
    const teammateId = this.teammate().id;
    const [first, ...others] = this.statuses.activitiesOf(teammateId)();
    if (Object.isUndefined(first))
      return new OrganizationCardNow(Resources.organizationNowIdleIcon, this.statuses.statusOf(teammateId)() === TeammateStatus.Stopped
        ? Resources.teammateStatusLabels[TeammateStatus.Stopped] : Resources.organizationNothingRunning, null);
    return new OrganizationCardNow(Resources.organizationNowRunningIcon, this.store.conversation(first.chatId)?.title ?? Resources.organizationNowReplying,
      Resources.formatOrganizationNowFor(this.time() - Date.parse(first.startedAt), others.length));
  });

  protected readonly activities: Signal<readonly OrganizationRunningReply[]> = computed(() =>
    this.statuses.activitiesOf(this.teammate().id)().map(t => new OrganizationRunningReply(t.chatId, this.store.conversation(t.chatId)?.title ?? Resources.organizationNowReplying,
      Resources.formatOrganizationNowFor(this.time() - Date.parse(t.startedAt), 0))));
  protected readonly roleLine: Signal<string | null> = computed(() => Resources.formatOrganizationRoleIn(this.teammate().role, this.departmentName() ?? this.department()?.name ?? null));

  protected readonly last: Signal<TeammateLastReply | null> = computed(() => this.statuses.lastReplyOf(this.teammate().id)());

  protected readonly chat: Signal<Conversation | null> = computed(() => this.store.organizationChatOf(this.organization.id(), this.teammate().id));
  protected readonly worksIn: Signal<string> = computed(() =>
    Resources.formatOrganizationWorksIn(this.teammate().name, ConversationActions.placeOf(this.store, this.chat()) ?? Resources.organizationOwnFolderInText));
  protected readonly inProject: Signal<boolean> = computed(() => !Object.isNull(this.chat()?.projectId ?? null));
  protected readonly attachedChat: Signal<Conversation | null> = computed(() => Object.isNull(this.chat()?.attachedFolder ?? null) ? null : this.chat());
  protected readonly otherProjects: Signal<readonly Project[]> = computed(() =>
    this.projectsLayout.ordered(this.store.projects()).filter(t => t.id !== this.chat()?.projectId));

  protected readonly editsIn: Signal<Department | null> = computed(() => this.editing() ? this.department() : null);
  protected readonly placeChoices: Signal<readonly OrganizationPlaceChoice[]> = computed(() =>
    OrganizationPlaceChoice.of(OrganizationNode.treeOf(this.organization.organization(), this.store.teammates()), OrganizationParent.teammate(this.teammate().id)));
  protected readonly placeOptions: Signal<readonly SelectOption[]> = computed(() => this.placeChoices().map(t => new SelectOption(t.key, t.label)));
  protected readonly placeKey: Signal<string> = computed(() =>
    OrganizationPlaceChoice.keyOf(this.organization.organization().parentOf(OrganizationParent.teammate(this.teammate().id)) ?? OrganizationParent.person));

  public constructor() {
    effect(onCleanup => {
      if (!this.fields().has(OrganizationCardField.Now) || this.statuses.activitiesOf(this.teammate().id)().length === 0)
        return;
      untracked(() => this.time.set(this.clock.now()));
      onCleanup(this.clock.every(Resources.clockIntervalMilliseconds, () => this.time.set(this.clock.now())));
    });
  }

  protected closeDetails(event: FocusEvent): void {
    if (event.target !== event.currentTarget)
      this.details?.close();
  }

  protected async moveToProject(project: Project): Promise<void> {
    const chat = await this.openChat();
    if (!Object.isNull(chat))
      await this.placement.moveToProject(chat, project);
  }

  protected async moveToFolder(): Promise<void> {
    const chat = await this.openChat();
    if (!Object.isNull(chat))
      await this.placement.moveToFolder(chat);
  }

  protected async attachFolder(): Promise<void> {
    const chat = await this.openChat();
    if (!Object.isNull(chat))
      await this.placement.attachFolder(chat);
  }

  protected async detachFolder(chat: Conversation): Promise<void> {
    await this.placement.detachFolder(chat);
  }

  protected move(key: string): void {
    for (const choice of this.placeChoices().filter(t => t.key === key))
      void this.organization.placeTeammate(this.teammate().id, choice.parent);
  }

  protected confirmLeaveUnit(department: Department): void {
    const teammate = this.teammate();
    this.confirm(new ConfirmRequest(Resources.organizationRemoveMemberTitle, Resources.formatOrganizationRemoveMember(teammate.name, department.name),
      Resources.organizationLeaveUnitLabel, null, true), () => void this.organization.setMember(teammate.id, null));
  }

  protected confirmRemove(): void {
    const teammate = this.teammate();
    const organization = this.organization.organization();
    const node = OrganizationParent.teammate(teammate.id);
    const holds = organization.placementsUnder(node).length > 0 || organization.departmentsUnder(node).length > 0;
    this.confirm(new ConfirmRequest(Resources.organizationRemoveTeammate,
      Resources.formatOrganizationRemoveFrom(teammate.name, organization.name, holds ? this.nameOf(organization.parentOf(node)) : null),
      Resources.organizationRemoveLabel, null, true), () => void this.organization.placeTeammate(teammate.id, null));
  }

  private confirm(request: ConfirmRequest, confirmed: () => void): void {
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", request);
    dialog.componentInstance?.answered.subscribe(answer => {
      dialog.close();
      if (answer)
        confirmed();
    });
  }

  private nameOf(parent: OrganizationParent | null): string {
    return [...this.store.teammates(), ...this.organization.organization().departments].find(t => t.id === parent?.id)?.name ?? Resources.organizationRemoveReportsToYou;
  }

  private async openChat(): Promise<Conversation | null> {
    return this.chat() ?? await this.organization.openOrganizationChat(this.teammate().id);
  }
}
