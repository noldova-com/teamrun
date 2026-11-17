/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked
} from "@angular/core";

import "@noldova/context.core";
import {
  AuthStatus,
  DefaultTeammate,
  Harness,
  NameOrder,
  type Provider,
  ProviderAbility,
  ProviderContextWindows,
  type ProviderKind,
  type ProviderMode,
  type ProviderModel,
  RequestedSettings,
  type Teammate,
  TeammateCreateParams,
  type TeammateFallback,
  TeammateName,
  TeammateUpdateParams
} from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, DialogComponent, DialogService, DialogSize, FieldMessageComponent, SelectComponent, SelectOption, TextFieldComponent }
  from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { AbilityRefusal } from "../../models/ability-refusal";
import { ProviderChoice } from "../../models/provider-choice";
import { ModelCatalog } from "../../models/model-catalog";
import { RefusedMode } from "../../models/refused-mode";
import type { ChatStoreService } from "../../services/chat-store.service";
import { UnrestrictedModeConfirmation } from "../../services/unrestricted-mode-confirmation";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { SustainSettingsComponent } from "../sustain-settings/sustain-settings.component";
import { UsageHandOffsComponent } from "../usage-hand-offs/usage-hand-offs.component";

@Component({
  selector: "nol-teamrun-teammate-dialog",
  imports: [ButtonComponent, DialogComponent, FieldMessageComponent, SelectComponent, SustainSettingsComponent, TextFieldComponent, UsageHandOffsComponent],
  templateUrl: "./teammate-dialog.component.html",
  styleUrls: ["../settings-dialog.css"]
})
export class TeammateDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly medium: DialogSize = DialogSize.Medium;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly usage: UsageFormatterService = inject(UsageFormatterService);

  public readonly store: InputSignal<ChatStoreService> = input.required<ChatStoreService>();
  public readonly teammate: InputSignal<Teammate | null> = input<Teammate | null>(null);
  public readonly choosesDefault: InputSignal<boolean> = input(false);
  public readonly first: InputSignal<boolean> = input(false);
  public readonly draftName: InputSignal<string | null> = input<string | null>(null);
  public readonly draftProviderId: InputSignal<string | null> = input<string | null>(null);
  public readonly closed: OutputEmitterRef<void> = output<void>();
  public readonly created: OutputEmitterRef<Teammate> = output<Teammate>();

  protected readonly name: WritableSignal<string> = linkedSignal(() => this.teammate()?.name ?? this.draftName() ?? this.suggestedName());
  protected readonly role: WritableSignal<string> = linkedSignal(() => this.teammate()?.role ?? String.empty);
  private readonly shownProviders: Signal<readonly (readonly [Provider, string])[]> = computed(() => {
    const kinds = this.store().kinds();
    return NameOrder.sort(this.store().providers(), t => kinds.find(u => u.id === t.kind)?.displayName ?? t.kind, t => t.label)
      .map(t => [t, ProviderChoice.ofProvider(t, kinds).fullLabel] as const);
  });
  protected readonly providerId: WritableSignal<string> = linkedSignal(() => this.teammate()?.providerId ?? this.chosenDefault()?.providerId
    ?? this.draftProviderId() ?? this.firstProvider()?.id ?? untracked(() => this.shownProviders().find(([t]) => t.enabled)?.[0].id) ?? String.empty);
  protected readonly model: WritableSignal<string | null> = linkedSignal(() => this.teammate()?.model ?? this.chosenDefault()?.requested.model ?? null);
  protected readonly effort: WritableSignal<string | null> = linkedSignal(() => this.teammate()?.effort ?? this.chosenDefault()?.requested.effort ?? null);
  protected readonly speed: WritableSignal<string | null> = linkedSignal(() => this.teammate()?.speed ?? this.chosenDefault()?.requested.speed ?? null);
  protected readonly mode: WritableSignal<string | null> = linkedSignal(() => this.teammate()?.mode ?? this.chosenDefault()?.requested.mode ?? null);
  protected readonly contextWindow: WritableSignal<number | null> = linkedSignal(() => this.teammate()?.contextWindow ?? null);
  protected readonly chosenSustain: WritableSignal<boolean> = linkedSignal(() => this.teammate()?.sustain ?? false);
  protected readonly sustain: Signal<boolean> = computed(() => this.chosenSustain() && this.descriptor()?.reportsLimits !== false);
  protected readonly sustainRefusal: Signal<string | null> = computed(() => this.refusedSustain() && this.descriptor()?.reportsLimits !== false ? this.error() : null);
  protected readonly handOffsRefusal: Signal<string | null> = computed(() => this.refusedHandOffs() && this.descriptor()?.reportsLimits !== false ? this.error() : null);
  protected readonly fallbacks: WritableSignal<readonly TeammateFallback[]> = linkedSignal(() => this.teammate()?.fallbacks ?? []);
  protected readonly resetsSoonestFirst: WritableSignal<boolean> = linkedSignal(() => this.teammate()?.resetsSoonestFirst ?? true);
  protected readonly usageHandOffs: WritableSignal<readonly string[]> = linkedSignal(() => this.teammate()?.usageHandOffs ?? []);
  protected readonly savedHandOffs: Signal<readonly string[]> = computed(() => this.descriptor()?.reportsLimits !== false ? this.usageHandOffs() : []);
  protected readonly customWindow: WritableSignal<string | null> = signal(null);
  protected readonly catalog: WritableSignal<ModelCatalog | null> = signal(null);
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly nameHintId: string = "nol-teamrun-teammate-name-hint";
  protected readonly nameMessageId: string = "nol-teamrun-teammate-name-message";
  protected readonly windowHintId: string = "nol-teamrun-context-window-hint";
  protected readonly effortRefusalId: string = "nol-teamrun-effort-refusal";
  protected readonly modeRefusalId: string = "nol-teamrun-mode-refusal";
  protected readonly speedRefusalId: string = "nol-teamrun-speed-refusal";
  protected readonly windowRefusalId: string = "nol-teamrun-context-window-refusal";
  private readonly takenName: WritableSignal<string | null> = signal(null);
  private readonly refusedSustain: WritableSignal<boolean> = signal(false);
  private readonly refusedHandOffs: WritableSignal<boolean> = signal(false);
  private readonly report: (message: string, takenName: string | null, sustain: boolean, handOffs: boolean) => void = (t, u, v, w) => {
    this.error.set(t);
    this.takenName.set(u);
    this.refusedSustain.set(v);
    this.refusedHandOffs.set(w);
  };

  protected readonly title: Signal<string> = computed(() => this.choosesDefault() ? Resources.defaultTeammateTitle : this.first() ? Resources.firstTeammateTitle
    : Object.isNull(this.teammate()) ? Resources.addTeammateLabel : Resources.editTeammateLabel);
  protected readonly provider: Signal<Provider | undefined> = computed(() => this.store().providers().find(t => t.id === this.providerId()));
  protected readonly selectedModel: Signal<ProviderModel | undefined> = computed(() => this.catalog()?.models.find(t => t.matches(this.model())));
  protected readonly descriptor: Signal<ProviderKind | undefined> = computed(() => this.store().kinds().find(t => t.id === this.provider()?.kind));
  protected readonly defaultModel: Signal<string> = computed(() =>
    this.descriptor()?.defaultModelName ?? Resources.formatDefaultModel(this.catalog()?.defaultModelName ?? null));
  protected readonly effortRefusal: Signal<string | null> = computed(() => AbilityRefusal.of(this.descriptor(), ProviderAbility.ChooseEffort, Resources.changeEffortAction));
  protected readonly speedRefusal: Signal<string | null> = computed(() => AbilityRefusal.of(this.descriptor(), ProviderAbility.ChooseSpeed, Resources.changeSpeedAction));
  protected readonly windowRefusal: Signal<string | null> = computed(() => this.choosesDefault() ? null
    : AbilityRefusal.of(this.descriptor(), ProviderAbility.ChooseContext, Resources.changeContextWindowAction));
  protected readonly refusedEffortOptions: readonly SelectOption[] = [new SelectOption(String.empty, Resources.modelDefaultEffort)];
  protected readonly refusedSpeedOptions: readonly SelectOption[] = [new SelectOption(String.empty, Resources.modelDefaultSpeed)];
  protected readonly refusedWindowOptions: readonly SelectOption[] = [new SelectOption(String.empty, Resources.defaultContextWindow)];
  protected readonly savedEffort: Signal<string | null> = computed(() => Object.isNull(this.effortRefusal()) ? this.effort() : null);
  private readonly savedSpeed: Signal<string | null> = computed(() => Object.isNull(this.speedRefusal()) ? this.speed() : null);
  private readonly savedWindow: Signal<number | null> = computed(() => Object.isNull(this.windowRefusal()) ? this.chosenWindow() : null);
  protected readonly efforts: Signal<readonly string[]> = computed(() => this.catalog()?.effortLevelsOf(this.model()) ?? []);
  protected readonly effortValue: Signal<string> = computed(() => this.effort() ?? this.catalog()?.selectedEffortOf(this.model()) ?? Resources.modelDefaultEffort);
  protected readonly unlistedReason: Signal<string | null> = computed(() => {
    const provider = this.provider();
    const descriptor = this.descriptor();
    const catalog = this.catalog();
    if (Object.isUndefined(provider) || Object.isUndefined(descriptor) || this.loading() || Object.isNull(catalog) || !catalog.unlisted && !catalog.empty && !catalog.awaitsTurn)
      return null;
    if (catalog.empty)
      return Resources.formatWithPlanChange(Resources.formatModelsCameBackEmpty(descriptor.displayName), descriptor.id, provider.profileDir);
    if (catalog.awaitsTurn)
      return Resources.formatModelsAwaitFirstReply(descriptor.displayName);
    return Resources.formatModelsNotListed(descriptor.displayName);
  });
  protected readonly planNote: Signal<string | null> = computed(() => {
    const note = this.loading() ? null : this.catalog()?.planNote(this.defaultModel()) ?? null;
    const provider = this.provider();
    return Object.isNull(note) || Object.isUndefined(provider) ? null : Resources.formatWithPlanChange(note, provider.kind, provider.profileDir);
  });
  protected readonly effortNote: Signal<string | null> = computed(() => {
    const catalog = this.catalog();
    if (this.loading() || Object.isNull(catalog) || catalog.models.length === 0 || this.efforts().length > 0 || !Object.isNull(this.effort()))
      return null;
    return Resources.noEffortLevels;
  });
  protected readonly isNameValid: Signal<boolean> = computed(() => TeammateDialogComponent.isValidName(this.name().trim()));
  protected readonly isNameInvalid: Signal<boolean> = computed(() => !String.isNullOrWhitespace(this.name()) && !this.isNameValid());
  protected readonly isNameTaken: Signal<boolean> = computed(() => !Object.isNull(this.takenName()));
  protected readonly isNameMarked: Signal<boolean> = computed(() => this.isNameInvalid() || this.isNameTaken());
  protected readonly nameDescribedBy: Signal<string> = computed(() => this.isNameTaken() ? `${this.nameMessageId} ${this.nameHintId}` : this.nameHintId);
  protected readonly canSave: Signal<boolean> = computed(() => (this.choosesDefault() ? !Object.isUndefined(this.provider()) : this.isNameValid())
    && this.providerId().length > 0 && !this.loading() && !this.saving() && !this.isWindowInvalid());

  protected readonly providerOptions: Signal<readonly SelectOption[]> = computed(() => {
    const saved = this.shownProviders().filter(([t]) => t.enabled || t.id === this.providerId())
      .map(([provider, label]) => new SelectOption(provider.id, provider.enabled ? label : Resources.formatDisabledProviderOption(label),
        this.usage.usedUpLabel(this.store().planUsageOfProvider(provider.id))));
    const unavailable = Object.isUndefined(this.provider()) && this.providerId().length > 0 ? [new SelectOption(this.providerId(), Resources.unavailableTeammateLabel)] : [];
    return [...unavailable, ...saved];
  });

  protected readonly modelOptions: Signal<readonly SelectOption[]> = computed(() => {
    const model = this.model();
    const unlisted = Object.isNull(model) || !Object.isUndefined(this.selectedModel()) ? [] : [new SelectOption(model, Resources.formatUnlisted(model))];
    return [new SelectOption(String.empty, this.defaultModel()), ...unlisted, ...(this.catalog()?.choices ?? []).map(t => new SelectOption(t.id, t.displayName))];
  });
  protected readonly modelValue: Signal<string> = computed(() => this.catalog()?.isAlias(this.selectedModel()) === true ? String.empty : this.model() ?? String.empty);

  protected readonly hasSpeeds: Signal<boolean> = computed(() => (this.catalog()?.speedsOf(this.model()).length ?? 0) > 0);
  protected readonly speedValue: Signal<string> = computed(() => this.speed() ?? this.catalog()!.defaultSpeedOf(this.model()) ?? String.empty);
  protected readonly speedOptions: Signal<readonly SelectOption[]> = computed(() => {
    const catalog = this.catalog()!;
    const standard = Object.isNull(catalog.defaultSpeedOf(this.model())) ? [new SelectOption(String.empty, Resources.modelDefaultSpeed)] : [];
    return [...standard, ...catalog.speedsOf(this.model()).map(t => new SelectOption(t.id, t.name ?? Resources.formatEffort(t.id)))];
  });

  protected readonly windows: Signal<ProviderContextWindows | null> = computed(() => this.catalog()?.windowsOf(this.model()) ?? null);
  protected readonly hasWindows: Signal<boolean> = computed(() => !this.choosesDefault() && (!Object.isNull(this.windows()) || !Object.isNull(this.contextWindow())));
  protected readonly windowValue: Signal<string> = computed(() => {
    const tokens = this.contextWindow();
    if (Object.isNull(this.customWindow()) && Object.isNull(tokens))
      return String.empty;
    return Object.isNull(this.customWindow()) && this.windows()?.presets.includes(tokens!) === true ? String(tokens) : Resources.customContextWindowValue;
  });
  protected readonly isCustomWindow: Signal<boolean> = computed(() => this.windowValue() === Resources.customContextWindowValue);
  protected readonly reportedWindow: Signal<string | null> = computed(() => {
    const windows = this.windows();
    return windows?.reported === true ? ProviderContextWindows.nameOf(windows.maximum) : null;
  });
  protected readonly windowOptions: Signal<readonly SelectOption[]> = computed(() => {
    const window = this.reportedWindow();
    return [new SelectOption(String.empty, Object.isNull(window) ? Resources.defaultContextWindow : Resources.formatDefaultContextWindow(window)),
    ...(this.windows()?.presets ?? []).map(t => new SelectOption(String(t), ProviderContextWindows.nameOf(t))),
    new SelectOption(Resources.customContextWindowValue, Resources.customContextWindowOption)];
  });
  protected readonly customWindowText: Signal<string> = computed(() => {
    const tokens = this.contextWindow();
    return this.customWindow() ?? (Object.isNull(tokens) ? String.empty : ProviderContextWindows.nameOf(tokens));
  });
  protected readonly chosenWindow: Signal<number | null> = computed(() => {
    const text = this.customWindow();
    return Object.isNull(text) ? this.contextWindow() : ProviderContextWindows.parse(text);
  });
  protected readonly isWindowInvalid: Signal<boolean> = computed(() => {
    const tokens = this.chosenWindow();
    return Object.isNull(this.windowRefusal()) && !Object.isNull(this.customWindow()) && (Object.isNull(tokens) || this.windows()?.allows(tokens) !== true);
  });
  protected readonly isWindowMarked: Signal<boolean> = computed(() => this.isWindowInvalid() && !String.isNullOrWhitespace(this.customWindow()!));
  protected readonly windowHint: Signal<string> = computed(() => {
    const windows = this.windows();
    const tokens = this.chosenWindow();
    const summary = Object.isNull(windows) || this.isWindowInvalid() ? null : Object.isNull(tokens)
      ? Resources.formatDefaultContextWindowSummary(this.reportedWindow())
      : Resources.formatContextWindowSummary(ProviderContextWindows.nameOf(tokens), this.reportedWindow());
    const bounds = this.isCustomWindow() && !Object.isNull(windows)
      ? Resources.formatContextWindowBounds(ProviderContextWindows.nameOf(windows.minimum), ProviderContextWindows.nameOf(windows.maximum)) : null;
    return [summary, bounds, Object.isNull(this.teammate()) ? null : Resources.contextWindowNextMessage].filter(t => !Object.isNull(t)).join(" ");
  });

  protected readonly hasModes: Signal<boolean> = computed(() => (this.catalog()?.modes.length ?? 0) > 0);
  protected readonly selectedMode: Signal<ProviderMode | undefined> = computed(() => this.catalog()?.modeOf(this.mode()));
  protected readonly modeValue: Signal<string> = computed(() => this.selectedMode()?.id ?? this.mode()!);
  protected readonly modeOptions: Signal<readonly SelectOption[]> = computed(() => {
    const catalog = this.catalog()!;
    const mode = this.mode();
    const unlisted = Object.isUndefined(this.selectedMode()) ? [new SelectOption(mode!, Resources.formatUnlisted(mode!))] : [];
    return [...unlisted, ...catalog.modes.map(t => new SelectOption(t.id, t.name, t.id === catalog.defaultMode ? Resources.defaultModeTag : null)),
      ...this.refusedModes().map(t => new SelectOption(Resources.formatRefusedModeValue(t.name), t.name, null, true))];
  });

  protected readonly refusedModes: Signal<readonly RefusedMode[]> = computed(() => RefusedMode.of(this.descriptor(), this.catalog()?.modes));

  protected readonly modeRefusal: Signal<string | null> = computed(() => this.refusedModes().length === 0 ? null : this.refusedModes().map(t => t.reason).join(" "));

  protected readonly modeDescribedBy: Signal<string | null> = computed(() => {
    const ids = [...Object.isNullOrUndefined(this.selectedMode()?.description) ? [] : [Resources.modeHintId], ...Object.isNull(this.modeRefusal()) ? [] : [this.modeRefusalId]];
    return ids.length === 0 ? null : ids.join(" ");
  });

  protected readonly effortOptions: Signal<readonly SelectOption[]> = computed(() => {
    const effort = this.effort() ?? this.catalog()?.selectedEffortOf(this.model()) ?? null;
    const unlisted = Object.isNull(effort) || this.efforts().includes(effort) ? []
      : [new SelectOption(effort, Resources.formatUnlisted(this.catalog()?.modelOf(this.model())?.effortNames[effort] ?? effort))];
    const recommended = this.catalog()?.defaultEffortOf(this.model()) ?? null;
    return [...unlisted, ...this.efforts().map(t => new SelectOption(t, ModelCatalog.effortNameIn(this.catalog(), this.model(), t),
      t === recommended ? Resources.recommendedEffortTag : null))];
  });

  private catalogGeneration: number = 0;
  private reconcileProvider: string | null = null;
  private reconcileKind: string | undefined;

  public constructor() {
    effect(() => {
      this.providerId();
      untracked(() => void this.loadModels());
    });
    effect(onCleanup => onCleanup(this.store().onReplyEnded(t => {
      if (this.catalog()?.awaitsTurn === true && t.provenance?.providerId === this.providerId())
        void this.loadModels(true, true);
    })));
  }

  protected editName(event: globalThis.Event): void {
    this.takenName.set(null);
    if (event.target instanceof HTMLInputElement)
      this.name.set(event.target.value);
  }

  protected editRole(event: globalThis.Event): void {
    if (event.target instanceof HTMLTextAreaElement)
      this.role.set(event.target.value);
  }

  protected changeProvider(id: string): void {
    if (id === this.providerId())
      return;
    if (Object.isNull(this.reconcileProvider))
      this.reconcileKind = this.provider()?.kind;
    this.reconcileProvider = id;
    this.mode.set(null);
    this.catalog.set(null);
    this.loading.set(true);
    this.providerId.set(id);
  }

  protected changeModel(value: string): void {
    const model = value.length === 0 ? null : value;
    if (model !== this.model()) {
      this.effort.set(null);
      this.speed.set(null);
      this.setWindow(this.catalog()?.resolveWindow(model, this.chosenWindow()) ?? null);
    }
    this.model.set(model);
  }

  protected changeSpeed(value: string): void {
    this.speed.set(value.length === 0 ? null : value);
  }

  protected changeWindow(value: string): void {
    if (value === Resources.customContextWindowValue)
      this.customWindow.set(this.customWindowText());
    else
      this.setWindow(value.length === 0 ? null : Number(value));
  }

  protected editCustomWindow(event: globalThis.Event): void {
    if (event.target instanceof HTMLInputElement)
      this.customWindow.set(event.target.value);
  }

  protected changeMode(id: string): void {
    const catalog = this.catalog()!;
    const mode = id === catalog.defaultMode ? null : id;
    if (mode !== this.mode())
      UnrestrictedModeConfirmation.choose(this.dialogs, catalog.modeOf(id), this.descriptor()!.displayName, () => this.mode.set(mode));
  }

  protected changeEffort(value: string): void {
    this.effort.set(value);
  }

  protected async loadModels(refresh: boolean = false, quiet: boolean = false): Promise<void> {
    const generation = ++this.catalogGeneration;
    const provider = this.provider();
    if (!refresh)
      this.catalog.set(null);
    this.loading.set(false);
    if (Object.isUndefined(provider) || !provider.enabled)
      return;

    this.loading.set(!quiet);
    const catalog = await this.store().modelCatalogs.load(provider.kind, provider.id, refresh);
    if (generation !== this.catalogGeneration)
      return;

    this.catalog.set(catalog);
    this.loading.set(false);
    const family = catalog.familyOf(this.model());
    if (!Object.isUndefined(family)) {
      this.effort.set(this.model());
      this.model.set(family.id);
    }
    if (this.reconcileProvider !== provider.id)
      return;
    if (catalog.failed) {
      if (this.reconcileKind !== provider.kind) {
        this.model.set(null);
        this.effort.set(null);
        this.speed.set(null);
        this.setWindow(null);
        this.reconcileProvider = null;
      }
      return;
    }

    const previous = this.model();
    const model = catalog.resolveModel(previous);
    this.model.set(model);
    this.effort.set(model === previous ? catalog.resolveEffort(model, this.effort()) : null);
    this.speed.set(model === previous ? catalog.resolveSpeed(model, this.speed()) : null);
    this.setWindow(model === previous ? catalog.resolveWindow(model, this.chosenWindow()) : null);
    this.reconcileProvider = null;
  }

  protected dismiss(): void {
    if (!this.saving())
      this.closed.emit();
  }

  protected async save(event: globalThis.Event): Promise<void> {
    event.preventDefault();
    if (!this.canSave())
      return;

    this.saving.set(true);
    this.error.set(null);
    this.takenName.set(null);
    const store = this.store();
    if (this.choosesDefault()) {
      const provider = this.provider()!;
      this.finish(await store.setDefaultTeammate(new DefaultTeammate(new RequestedSettings(provider.kind, this.model(), this.savedEffort(), this.savedSpeed(), this.mode()),
        provider.id), this.report));
      return;
    }
    const original = this.teammate();
    const name = this.name().trim();
    const role = String.isNullOrWhitespace(this.role()) ? null : this.role().trim();
    if (!Object.isNull(original)) {
      this.finish(await store.updateTeammate(original.id, TeammateUpdateParams.changing(original, {
        name, role, providerId: this.providerId(), harness: Harness.Provider, model: this.model(), effort: this.savedEffort(), speed: this.savedSpeed(), mode: this.mode(),
        contextWindow: this.savedWindow(), usageHandOffs: this.savedHandOffs(), sustain: this.sustain(), fallbacks: this.fallbacks(),
        resetsSoonestFirst: this.resetsSoonestFirst()
      }), this.report));
      return;
    }
    const teammate = await store.createTeammate(new TeammateCreateParams(name, role, this.providerId(), Harness.Provider, this.model(), this.savedEffort(), this.savedSpeed(),
      this.mode(), this.savedWindow(), this.savedHandOffs(), this.sustain(), this.fallbacks(), this.resetsSoonestFirst()), this.report);
    if (!Object.isNull(teammate))
      this.created.emit(teammate);
    this.finish(!Object.isNull(teammate));
  }

  private setWindow(tokens: number | null): void {
    this.customWindow.set(null);
    this.contextWindow.set(tokens);
  }

  private chosenDefault(): DefaultTeammate | null {
    return this.choosesDefault() ? untracked(() => this.store().defaultTeammate()) : null;
  }

  private firstProvider(): Provider | undefined {
    if (!this.first())
      return undefined;
    const providers = untracked(() => this.store().enabledProviders().toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)));
    return providers.find(t => t.authStatus === AuthStatus.LoggedIn) ?? providers[0];
  }

  private suggestedName(): string {
    const provider = this.firstProvider();
    return Object.isUndefined(provider) ? String.empty : Resources.firstTeammateNames.get(provider.kind) ?? provider.label;
  }

  private finish(saved: boolean): void {
    this.saving.set(false);
    if (saved)
      this.closed.emit();
  }

  private static isValidName(name: string): boolean {
    try {
      TeammateName.validate(name);
      return true;
    }
    catch {
      return false;
    }
  }
}
