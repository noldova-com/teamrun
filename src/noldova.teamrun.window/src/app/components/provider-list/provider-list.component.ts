/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, input, type InputSignal, type TemplateRef } from "@angular/core";

import "@noldova/context.core";
import { ChipComponent, ChipKind, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { UsageLevel } from "../../enums/usage-level";
import type { ProviderFoundRow } from "../../models/provider-found-row";
import type { ProviderListGroup } from "../../models/provider-list-group";
import type { ProviderRow } from "../../models/provider-row";

@Component({
  selector: "nol-teamrun-provider-list",
  imports: [ChipComponent, NgTemplateOutlet, TooltipDirective],
  templateUrl: "./provider-list.component.html",
  styleUrls: ["../settings-view.css", "./provider-list.component.css"]
})
export class ProviderListComponent {
  public readonly label: InputSignal<string> = input.required<string>();
  public readonly groups: InputSignal<readonly ProviderListGroup[]> = input<readonly ProviderListGroup[]>([]);
  public readonly empty: InputSignal<string> = input.required<string>();
  public readonly rowStep: InputSignal<TemplateRef<{ $implicit: ProviderRow }> | null> = input<TemplateRef<{ $implicit: ProviderRow }> | null>(null);
  public readonly rowActions: InputSignal<TemplateRef<{ $implicit: ProviderRow }> | null> = input<TemplateRef<{ $implicit: ProviderRow }> | null>(null);
  public readonly asking: InputSignal<string | null> = input<string | null>(null);
  public readonly question: InputSignal<string> = input<string>("");
  public readonly kindActions: InputSignal<TemplateRef<{ $implicit: ProviderListGroup }> | null> = input<TemplateRef<{ $implicit: ProviderListGroup }> | null>(null);
  public readonly foundActions: InputSignal<TemplateRef<{ $implicit: ProviderFoundRow }> | null> = input<TemplateRef<{ $implicit: ProviderFoundRow }> | null>(null);

  protected readonly resources: typeof Resources = Resources;
  protected readonly chips: typeof ChipKind = ChipKind;
  protected readonly levels: typeof UsageLevel = UsageLevel;

  public static questionIdOf(providerId: string): string {
    return `nol-teamrun-question-${providerId}`;
  }

  protected questionId(row: ProviderRow): string {
    return ProviderListComponent.questionIdOf(row.provider.id);
  }
}
