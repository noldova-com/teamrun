/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ProviderContextWindows, type ProviderMode, type ProviderModel, type ProviderSpeed, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class ModelCatalog {
  public readonly models: readonly ProviderModel[];
  public readonly fetchedAt: number;
  public readonly failed: boolean;
  public readonly signedIn: boolean | null;
  public readonly empty: boolean;
  public readonly planName: string | null;
  public readonly awaitsTurn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  public readonly defaultTakesListedEfforts: boolean;

  public readonly planMode: string | null;

  public constructor(models: readonly ProviderModel[], fetchedAt: number, failed: boolean, signedIn: boolean | null = null, empty: boolean = false,
    planName: string | null = null, awaitsTurn: boolean = false, modes: readonly ProviderMode[] = [], defaultMode: string | null = null,
    defaultTakesListedEfforts: boolean = false, planMode: string | null = null) {
    this.models = [...models];
    this.fetchedAt = fetchedAt;
    this.failed = failed;
    this.signedIn = signedIn;
    this.empty = empty;
    this.planName = planName;
    this.awaitsTurn = awaitsTurn;
    this.modes = [...modes];
    this.defaultMode = defaultMode;
    this.defaultTakesListedEfforts = defaultTakesListedEfforts;
    this.planMode = planMode;
  }

  public get unlisted(): boolean {
    return !this.failed && !this.empty && !this.awaitsTurn && Object.isNull(this.planName) && this.fetchedAt > 0 && this.models.length === 0;
  }

  public get knowsModels(): boolean {
    return !this.failed && !this.empty && this.fetchedAt > 0 && (this.models.length > 0 || !Object.isNull(this.planName));
  }

  public get defaultModelName(): string | null {
    return this.models.find(t => t.isDefault)?.displayName ?? null;
  }

  public get choices(): readonly ProviderModel[] {
    return this.models.filter(t => !this.isAlias(t));
  }

  public isAlias(model: ProviderModel | undefined): boolean {
    return model?.isDefault === true && !Object.isNull(model.resolvedModel) && this.models.some(t => t !== model && t.resolvedModel === model.resolvedModel);
  }

  public planNote(model: string): string | null {
    return Object.isNull(this.planName) ? null : Resources.formatPlanIncludesOnly(this.planName, model);
  }

  public modelOf(model: string | null): ProviderModel | undefined {
    return this.models.find(t => t.matches(model)) ?? this.familyOf(model);
  }

  public familyOf(model: string | null): ProviderModel | undefined {
    return Object.isNull(model) || this.models.some(t => t.matches(model)) ? undefined : this.models.find(t => t.effortLevels?.includes(model) === true);
  }

  public effortLevelsOf(model: string | null): readonly string[] {
    const listed = this.modelOf(model);
    return Object.isNull(model) && Object.isUndefined(listed) && this.defaultTakesListedEfforts ? this.everyEffortLevel() : listed?.effortLevels ?? [];
  }

  public defaultEffortOf(model: string | null): string | null {
    return this.modelOf(model)?.defaultEffort ?? null;
  }

  public selectedEffortOf(model: string | null): string | null {
    const listed = this.modelOf(model);
    return listed?.configuredEffort ?? listed?.defaultEffort ?? null;
  }

  public static effortNameIn(catalog: ModelCatalog | null | undefined, model: string | null, effort: string | null): string {
    return catalog?.effortName(model, effort) ?? Resources.formatEffort(effort);
  }

  public effortName(model: string | null, effort: string | null): string {
    const listed = this.modelOf(model);
    const level = effort ?? (Object.isUndefined(this.familyOf(model)) ? this.selectedEffortOf(model) : model);
    return Object.isNull(level) ? Resources.formatEffort(null) : listed?.effortNames[level] ?? Resources.formatEffort(level);
  }

  public resolveModel(model: string | null): string | null {
    return Object.isNull(model) || !Object.isUndefined(this.modelOf(model)) ? model : null;
  }

  public speedsOf(model: string | null): readonly ProviderSpeed[] {
    return this.modelOf(model)?.speeds ?? [];
  }

  public defaultSpeedOf(model: string | null): string | null {
    return this.modelOf(model)?.defaultSpeed ?? null;
  }

  public resolveSpeed(model: string | null, speed: string | null): string | null {
    return this.modelOf(model)?.speeds.some(t => t.id === speed) === true ? speed : null;
  }

  public windowsOf(model: string | null): ProviderContextWindows | null {
    return this.modelOf(model)?.contextWindows ?? null;
  }

  public resolveWindow(model: string | null, tokens: number | null): number | null {
    return !Object.isNull(tokens) && this.windowsOf(model)?.allows(tokens) === true ? tokens : null;
  }

  public modeOf(mode: string | null): ProviderMode | undefined {
    return this.modes.find(t => t.id === (mode ?? this.defaultMode));
  }

  public resolveMode(mode: string | null): string | null {
    return this.modes.some(t => t.id === mode) ? mode : null;
  }

  public resolveEffort(model: string | null, effort: string | null): string | null {
    return !Object.isNull(effort) && this.effortLevelsOf(model).includes(effort) ? effort : null;
  }

  private everyEffortLevel(): readonly string[] {
    const levels = [...new Set(this.models.flatMap(t => t.effortLevels ?? []))];
    return levels.sort((a, b) => ModelCatalog.effortRank(a) - ModelCatalog.effortRank(b));
  }

  private static effortRank(level: string): number {
    const rank = ProtocolResources.effortLevelOrder.indexOf(level);
    return rank < 0 ? ProtocolResources.effortLevelOrder.length : rank;
  }
}
