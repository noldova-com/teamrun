/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";

import type { Teammate } from "@noldova/teamrun.protocol";
import { IconButtonComponent, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective,
  MeterComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationCardField } from "../../enums/organization-card-field";
import { UsageLevel } from "../../enums/usage-level";
import type { UsageMeter } from "../../models/usage-meter";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateWorkComponent } from "../teammate-work/teammate-work.component";

@Component({
  selector: "nol-teamrun-organization-card",
  imports: [IconButtonComponent, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, MeterComponent,
    TeammateAvatarComponent, TeammateWorkComponent],
  providers: [ChatStoreService.provider, OrganizationLayoutService.provider],
  host: { class: "nol-teamrun-organization-card" },
  templateUrl: "./organization-card.component.html",
  styleUrl: "./organization-card.component.css"
})
export class OrganizationCardComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: UsageFormatterService = inject(UsageFormatterService);

  public readonly teammate: InputSignal<Teammate> = input.required<Teammate>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly fieldNames: typeof OrganizationCardField = OrganizationCardField;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly fields: Signal<ReadonlySet<OrganizationCardField>> = computed(() => this.layout.layout().fieldsOf(this.teammate().id));
  protected readonly showsWork: Signal<boolean> = computed(() => Resources.organizationWorkFields.some(t => this.fields().has(t)));
  protected readonly usage: Signal<{ readonly meter: UsageMeter; readonly used: number } | null> = computed(() => {
    const plan = this.store.planUsageOfProvider(this.teammate().providerId);
    for (const meter of Object.isNull(plan) ? [] : this.formatter.limitsOf(plan))
      if (!Object.isNull(meter.percent))
        return { meter, used: (Resources.wholePercent - meter.percent) / Resources.wholePercent };
    return null;
  });
  protected readonly model: Signal<string | null> = computed(() => {
    const teammate = this.teammate();
    return Object.isNull(teammate.model) ? null : Resources.formatOrganizationModel(teammate.model, teammate.effort);
  });

  protected isWarning(meter: UsageMeter): boolean {
    return meter.level !== UsageLevel.Normal;
  }
}
