/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type ModelSignal, type Signal, type WritableSignal, computed, inject, input, model, signal } from "@angular/core";

import "@noldova/context.core";
import type { Teammate } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  ConfigurationTableActionDirective,
  ConfigurationTableComponent,
  ConfigurationTableDirective,
  ConfigurationTableFillDirective,
  ConfigurationTableRowActionsDirective,
  FieldMessageComponent,
  IconButtonComponent,
  SelectComponent,
  SelectOption,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ProviderChoice } from "../../models/provider-choice";
import type { ChatStoreService } from "../../services/chat-store.service";
import { FormatterService } from "../../services/formatter.service";

@Component({
  selector: "nol-teamrun-usage-hand-offs",
  imports: [ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective,
    ConfigurationTableRowActionsDirective, FieldMessageComponent, IconButtonComponent, SelectComponent, TooltipDirective],
  templateUrl: "./usage-hand-offs.component.html",
  styleUrls: ["../settings-dialog.css", "./usage-hand-offs.component.css"]
})
export class UsageHandOffsComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  private readonly formatter: FormatterService = inject(FormatterService);

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly teammateId: InputSignal<string | null> = input<string | null>(null);
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly unavailableReasonId: InputSignal<string | null> = input<string | null>(null);
  public readonly refusal: InputSignal<string | null> = input<string | null>(null);
  public readonly handOffs: ModelSignal<readonly string[]> = model<readonly string[]>([]);

  private readonly others: Signal<readonly Teammate[]> = computed(() => this.store().teammates().filter(t => t.id !== this.teammateId()));
  protected readonly rows: Signal<readonly Teammate[]> = computed(() => {
    const others = this.others();
    return this.handOffs().flatMap(t => others.filter(u => u.id === t));
  });
  protected readonly added: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly canAdd: Signal<boolean> = computed(() => this.others().length > this.rows().length);

  protected options(teammate: Teammate): readonly SelectOption[] {
    const chosen = new Set(this.handOffs());
    return this.others().filter(t => t.id === teammate.id || !chosen.has(t.id)).map(t => new SelectOption(t.id, t.name));
  }

  protected providerOf(teammate: Teammate): string {
    const provider = this.store().providers().find(t => t.id === teammate.providerId);
    return Object.isUndefined(provider) ? Resources.unavailableTeammateLabel : ProviderChoice.ofProvider(provider, this.store().kinds()).fullLabel;
  }

  protected modelOf(teammate: Teammate): string {
    return this.formatter.teammateModel(teammate, this.store().providers(), this.store().kinds());
  }

  protected effortOf(teammate: Teammate): string {
    return Resources.formatEffort(teammate.effort);
  }

  protected add(): void {
    const chosen = new Set(this.handOffs());
    const ids = this.others().filter(t => !chosen.has(t.id)).slice(0, 1).map(t => t.id);
    this.added.set(new Set([...this.added(), ...ids]));
    this.handOffs.set([...this.rows().map(t => t.id), ...ids]);
  }

  protected change(index: number, teammateId: string): void {
    this.added.set(new Set([...this.added(), teammateId]));
    this.handOffs.set(this.rows().map((t, i) => i === index ? teammateId : t.id));
  }

  protected move(index: number, step: number): void {
    const ids = this.rows().map(t => t.id);
    const rest = ids.filter((_, i) => i !== index);
    this.handOffs.set([...rest.slice(0, index + step), ...ids.slice(index, index + 1), ...rest.slice(index + step)]);
  }

  protected remove(index: number): void {
    this.handOffs.set(this.rows().filter((_, i) => i !== index).map(t => t.id));
  }
}
