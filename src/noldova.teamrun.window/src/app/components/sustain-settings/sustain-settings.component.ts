/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type ModelSignal, type Signal, type WritableSignal, computed, effect, input, model, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import { NameOrder, type Provider, type ProviderKind, TeammateFallback } from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  CheckboxComponent,
  ConfigurationTableActionDirective,
  ConfigurationTableComponent,
  ConfigurationTableDirective,
  ConfigurationTableFillDirective,
  ConfigurationTableRowActionsDirective,
  FieldMessageComponent,
  IconButtonComponent,
  SelectComponent,
  SelectGroup,
  SelectOption,
  SwitchComponent,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ModelCatalog } from "../../models/model-catalog";
import { ProviderChoice } from "../../models/provider-choice";
import type { ChatStoreService } from "../../services/chat-store.service";

@Component({
  selector: "nol-teamrun-sustain-settings",
  imports: [ButtonComponent, CheckboxComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective,
    ConfigurationTableFillDirective, ConfigurationTableRowActionsDirective, FieldMessageComponent, IconButtonComponent, SelectComponent, SwitchComponent,
    TooltipDirective],
  templateUrl: "./sustain-settings.component.html",
  styleUrls: ["../settings-dialog.css", "./sustain-settings.component.css"]
})
export class SustainSettingsComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly providerId: InputSignal<string> = input.required<string>();
  public readonly model: InputSignal<string | null> = input.required<string | null>();
  public readonly effort: InputSignal<string | null> = input.required<string | null>();
  public readonly disabled: InputSignal<boolean> = input(false);
  public readonly refusal: InputSignal<string | null> = input<string | null>(null);
  public readonly sustain: ModelSignal<boolean> = model(false);
  public readonly fallbacks: ModelSignal<readonly TeammateFallback[]> = model<readonly TeammateFallback[]>([]);
  public readonly resetsSoonestFirst: ModelSignal<boolean> = model(true);

  protected readonly headingId: string = "nol-teamrun-sustain-heading";
  protected readonly reasonId: string = Resources.sustainReasonId;
  protected readonly added: WritableSignal<ReadonlySet<TeammateFallback>> = signal(new Set<TeammateFallback>());
  private readonly catalogs: WritableSignal<ReadonlyMap<string, ModelCatalog>> = signal(new Map<string, ModelCatalog>());

  private readonly providers: Signal<ReadonlyMap<string, Provider>> = computed(() => new Map(this.store().providers().map(t => [t.id, t])));
  private readonly kinds: Signal<ReadonlyMap<string, ProviderKind>> = computed(() => {
    const kinds = this.store().kinds();
    return new Map(this.store().providers().flatMap(t => kinds.filter(u => u.id === t.kind).map(u => [t.id, u] as const)));
  });
  protected readonly unavailable: Signal<string | null> = computed(() => {
    const kind = this.kinds().get(this.providerId());
    return Object.isUndefined(kind) || kind.reportsLimits ? null : Resources.formatSustainUnavailable(kind.displayName);
  });
  protected readonly listedProviders: Signal<readonly Provider[]> = computed(() => {
    const reading = new Set([...this.kinds()].filter(([, kind]) => kind.reportsLimits).map(([id]) => id));
    return NameOrder.sort([...this.providers().values()].filter(t => reading.has(t.id)), t => this.providerLabel(t.id));
  });
  protected readonly unreadKinds: Signal<readonly SelectGroup[]> = computed(() => {
    const kinds = this.store().kinds().filter(t => !t.reportsLimits);
    return kinds.length === 0 ? [] : [new SelectGroup(Resources.sustainUnreadKindsGroup, kinds.map(t => new SelectOption(t.id, t.displayName, null, true)))];
  });
  protected readonly ownProvider: Signal<string> = computed(() => this.providerLabel(this.providerId()));
  protected readonly ownModel: Signal<string> = computed(() => {
    const chosen = this.model();
    return Object.isNull(chosen) ? this.defaultModelOf(this.providerId()) : this.catalogs().get(this.providerId())?.modelOf(chosen)?.displayName ?? chosen;
  });
  protected readonly ownEffort: Signal<string> = computed(() => ModelCatalog.effortNameIn(this.catalogs().get(this.providerId()), this.model(), this.effort()));

  public constructor() {
    effect(() => {
      const wanted = [...new Set([this.providerId(), ...this.fallbacks().map(t => t.providerId)])];
      untracked(() => wanted.forEach(t => void this.loadCatalog(t)));
    });
  }

  protected toggleSustain(): void {
    if (!this.disabled() && Object.isNull(this.unavailable()))
      this.sustain.set(!this.sustain());
  }

  protected providerOptions(entry: TeammateFallback): readonly (SelectOption | SelectGroup)[] {
    return [...this.listedOptions(entry), ...this.unreadKinds()];
  }

  protected listedOptions(entry: TeammateFallback): readonly SelectOption[] {
    const listed = this.listedProviders().map(t => new SelectOption(t.id, this.providerLabel(t.id)));
    return listed.some(t => t.value === entry.providerId) ? listed : [new SelectOption(entry.providerId, Resources.unavailableTeammateLabel), ...listed];
  }

  protected modelOptions(entry: TeammateFallback): readonly SelectOption[] {
    const listed = (this.catalogs().get(entry.providerId)?.choices ?? []).map(t => new SelectOption(t.id, t.displayName));
    const unlisted = Object.isNull(entry.model) || listed.some(t => t.value === entry.model) ? [] : [new SelectOption(entry.model, Resources.formatUnlisted(entry.model))];
    return [new SelectOption(String.empty, this.defaultModelOf(entry.providerId)), ...unlisted, ...listed];
  }

  protected effortOptions(entry: TeammateFallback): readonly SelectOption[] {
    const catalog = this.catalogs().get(entry.providerId);
    const levels = catalog?.effortLevelsOf(entry.model) ?? [];
    const unlisted = Object.isNull(entry.effort) || levels.includes(entry.effort) ? []
      : [new SelectOption(entry.effort, Resources.formatUnlisted(ModelCatalog.effortNameIn(catalog, entry.model, entry.effort)))];
    return [new SelectOption(String.empty, Resources.modelDefaultEffort), ...unlisted,
      ...levels.map(t => new SelectOption(t, ModelCatalog.effortNameIn(catalog, entry.model, t)))];
  }

  protected wayOf(index: number): string {
    const chain = [this.providerId(), ...this.fallbacks().map(t => t.providerId)];
    const [from, to] = chain.slice(index, index + 2).map(t => this.kinds().get(t));
    if (Object.isUndefined(to) || to !== from || !to.carriesSessions)
      return Resources.sustainNewSessionWay;
    return to.sessionsChecked ? Resources.sustainSameSessionWay : Resources.sustainSameSessionUncheckedWay;
  }

  protected titleOf(options: readonly SelectOption[], value: string): string {
    return options.filter(t => t.value === value).map(t => t.title).join(String.empty);
  }

  protected entryLabel(index: number, entry: TeammateFallback): string {
    return Resources.formatSustainEntry(index + 2, this.providerLabel(entry.providerId));
  }

  protected add(): void {
    const listed = this.listedProviders();
    const chosen = [...listed.filter(t => t.id !== this.providerId()), ...listed].slice(0, 1);
    const entries = chosen.map(t => new TeammateFallback(t.id));
    this.added.set(new Set([...this.added(), ...entries]));
    this.fallbacks.set([...this.fallbacks(), ...entries]);
  }

  protected changeProvider(index: number, providerId: string): void {
    this.replace(index, entry => entry.providerId === providerId ? entry : new TeammateFallback(providerId));
  }

  protected changeModel(index: number, value: string): void {
    const chosen = value.length === 0 ? null : value;
    this.replace(index, entry => entry.model === chosen ? entry : new TeammateFallback(entry.providerId, chosen));
  }

  protected changeEffort(index: number, value: string): void {
    this.replace(index, entry => new TeammateFallback(entry.providerId, entry.model, value.length === 0 ? null : value));
  }

  protected move(index: number, by: number): void {
    const entries = this.fallbacks();
    this.fallbacks.set(entries.toSpliced(index, 1).toSpliced(index + by, 0, ...entries.slice(index, index + 1)));
  }

  protected remove(index: number): void {
    this.fallbacks.set(this.fallbacks().toSpliced(index, 1));
  }

  private replace(index: number, change: (entry: TeammateFallback) => TeammateFallback): void {
    const entries = this.fallbacks().map((t, i) => i === index ? change(t) : t);
    this.added.set(new Set([...this.added(), ...entries.slice(index, index + 1)]));
    this.fallbacks.set(entries);
  }

  private async loadCatalog(providerId: string): Promise<void> {
    const provider = this.providers().get(providerId);
    if (Object.isUndefined(provider) || !provider.enabled || this.catalogs().has(providerId))
      return;
    const catalog = await this.store().modelCatalogs.load(provider.kind, provider.id);
    this.catalogs.set(new Map([...this.catalogs(), [providerId, catalog]]));
  }

  private providerLabel(providerId: string): string {
    const provider = this.providers().get(providerId);
    return Object.isUndefined(provider) ? Resources.unavailableTeammateLabel : ProviderChoice.ofProvider(provider, this.store().kinds()).fullLabel;
  }

  private defaultModelOf(providerId: string): string {
    return this.kinds().get(providerId)?.defaultModelName ?? Resources.formatDefaultModel(this.catalogs().get(providerId)?.defaultModelName ?? null);
  }
}
