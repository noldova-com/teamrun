/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, type InputSignal, input, type Signal, signal, untracked, type WritableSignal } from "@angular/core";

import type { Department, Organization, Teammate } from "@noldova/teamrun.protocol";
import { PopoverDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { TeammateStatus } from "../../enums/teammate-status";
import { ChatStoreService } from "../../services/chat-store.service";
import { ClockService } from "../../services/clock.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { TeammateStatusStoreService } from "../../services/teammate-status-store.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";

@Component({
  selector: "nol-teamrun-organization-details",
  imports: [PopoverDirective, TeammateAvatarComponent, TeammateStatusComponent],
  providers: [ChatStoreService.provider, OrganizationStoreService.provider, TeammateStatusStoreService.provider],
  host: { class: "nol-teamrun-organization-details" },
  templateUrl: "./organization-details.component.html",
  styleUrl: "./organization-details.component.css"
})
export class OrganizationDetailsComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: UsageFormatterService = inject(UsageFormatterService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly statuses: TeammateStatusStoreService = inject(TeammateStatusStoreService);
  private readonly clock: ClockService = inject(ClockService);
  private readonly time: WritableSignal<number> = signal(this.clock.now());

  public readonly teammate: InputSignal<Teammate> = input.required<Teammate>();
  public readonly department: InputSignal<Department | null> = input.required<Department | null>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly label: Signal<string> = computed(() => Resources.formatOrganizationDetailsLabel(this.teammate().name));
  protected readonly place: Signal<string> = computed(() =>
    [this.teammate().role, this.department()?.name ?? Resources.organizationNoDepartment].filter(t => !Object.isNull(t)).join(Resources.titleSeparator));
  protected readonly reportsTo: Signal<string> = computed(() => {
    const leader = OrganizationDetailsComponent.leaderAbove(this.organization.organization(), this.store.teammates(), this.department(), this.teammate().id);
    return Object.isNull(leader) ? Resources.organizationOwnerName : leader.name;
  });
  protected readonly model: Signal<string> = computed(() => {
    const teammate = this.teammate();
    return Object.isNull(teammate.model) ? Resources.providerDefaultModel : Resources.formatOrganizationModel(teammate.model, teammate.effort);
  });
  protected readonly usage: Signal<string> = computed(() => {
    const plan = this.store.planUsageOfProvider(this.teammate().providerId);
    for (const meter of Object.isNull(plan) ? [] : this.formatter.limitsOf(plan))
      if (!Object.isNull(meter.percent))
        return Resources.formatOrganizationDetailsUsage((Resources.wholePercent - meter.percent) / Resources.wholePercent, meter.label);
    return Resources.organizationDetailsNoUsage;
  });
  protected readonly last: Signal<{ readonly text: string; readonly ago: string } | null> = computed(() => {
    const reply = this.statuses.lastReplyOf(this.teammate().id)();
    return Object.isNull(reply) ? null
      : { text: reply.text, ago: Resources.formatAgo(Math.floor(Math.max(0, this.time() - Date.parse(reply.endedAt)) / Resources.minuteMilliseconds)) };
  });
  protected readonly running: Signal<readonly { readonly chatId: string; readonly text: string; readonly lasted: string }[]> = computed(() =>
    this.statuses.activitiesOf(this.teammate().id)().map(t => ({
      chatId: t.chatId,
      text: this.store.conversation(t.chatId)?.title ?? Resources.organizationNowReplying,
      lasted: Resources.formatOrganizationNowFor(this.time() - Date.parse(t.startedAt), 0)
    })));
  protected readonly idle: Signal<string> = computed(() => this.statuses.statusOf(this.teammate().id)() === TeammateStatus.Stopped
    ? Resources.teammateStatusLabels[TeammateStatus.Stopped] : Resources.organizationNothingRunning);

  public constructor() {
    effect(onCleanup => {
      if (this.statuses.activitiesOf(this.teammate().id)().length === 0)
        return;
      untracked(() => this.time.set(this.clock.now()));
      onCleanup(this.clock.every(Resources.clockIntervalMilliseconds, () => this.time.set(this.clock.now())));
    });
  }

  private static leaderAbove(organization: Organization, teammates: readonly Teammate[], department: Department | null, teammateId: string): Teammate | null {
    let current: Department | undefined = department ?? undefined;
    while (!Object.isUndefined(current)) {
      const leaderId: string | null = current.leaderId;
      const leader = leaderId === teammateId ? undefined : teammates.find(t => t.id === leaderId);
      if (!Object.isUndefined(leader))
        return leader;
      const parentId: string | null = current.parentId;
      current = organization.departments.find(t => t.id === parentId);
    }
    return null;
  }
}
