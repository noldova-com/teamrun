/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, type InputSignal, input, type Signal } from "@angular/core";

import type { Department, Teammate } from "@noldova/teamrun.protocol";
import { DialogService, IconButtonComponent, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective,
  MeterComponent, SelectComponent, SelectOption } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { OrganizationCardField } from "../../enums/organization-card-field";
import { OrganizationCardShape } from "../../enums/organization-card-shape";
import { UsageLevel } from "../../enums/usage-level";
import { ConfirmRequest } from "../../models/confirm-request";
import { OrganizationNode } from "../../models/organization-node";
import type { UsageMeter } from "../../models/usage-meter";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationLayoutService } from "../../services/organization-layout.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { TeammateAvatarComponent } from "../teammate-avatar/teammate-avatar.component";
import { TeammateStatusComponent } from "../teammate-status/teammate-status.component";

@Component({
  selector: "nol-teamrun-organization-card",
  imports: [IconButtonComponent, MenuComponent, MenuGroupComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, MeterComponent,
    SelectComponent, TeammateAvatarComponent, TeammateStatusComponent],
  providers: [ChatStoreService.provider, OrganizationLayoutService.provider, OrganizationStoreService.provider],
  host: { class: "nol-teamrun-organization-card", "[class.fluid]": "shape() === shapes.Fluid", "[class.row]": "shape() === shapes.Row" },
  templateUrl: "./organization-card.component.html",
  styleUrl: "./organization-card.component.css"
})
export class OrganizationCardComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: UsageFormatterService = inject(UsageFormatterService);
  private readonly organization: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly dialogs: DialogService = inject(DialogService);

  public readonly teammate: InputSignal<Teammate> = input.required<Teammate>();
  public readonly shape: InputSignal<OrganizationCardShape> = input<OrganizationCardShape>(OrganizationCardShape.Card);
  public readonly editing: InputSignal<boolean> = input(false);
  public readonly department: InputSignal<Department | null> = input<Department | null>(null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly fieldNames: typeof OrganizationCardField = OrganizationCardField;
  protected readonly shapes: typeof OrganizationCardShape = OrganizationCardShape;
  protected readonly layout: OrganizationLayoutService = inject(OrganizationLayoutService);
  protected readonly fields: Signal<ReadonlySet<OrganizationCardField>> = computed(() => this.layout.layout().fieldsOf(this.teammate().id));
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

  protected readonly editsIn: Signal<Department | null> = computed(() => this.editing() ? this.department() : null);
  protected readonly departmentOptions: Signal<readonly SelectOption[]> = computed(() =>
    OrganizationNode.departmentsOf(this.organization.organization()).map(t => new SelectOption(t.id, t.name)));

  protected move(departmentId: string): void {
    void this.organization.setMember(this.teammate().id, departmentId);
  }

  protected confirmRemove(department: Department): void {
    const teammate = this.teammate();
    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel");
    dialog.componentRef?.setInput("request", new ConfirmRequest(Resources.organizationRemoveMemberTitle,
      Resources.formatOrganizationRemoveMember(teammate.name, department.name), Resources.organizationRemoveLabel, null, true));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed)
        void this.organization.setMember(teammate.id, null);
    });
  }

  protected isWarning(meter: UsageMeter): boolean {
    return meter.level !== UsageLevel.Normal;
  }
}
