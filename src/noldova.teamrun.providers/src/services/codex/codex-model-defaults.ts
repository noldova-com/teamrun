/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";
import { ProviderModel } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class CodexModelDefaults {
  public readonly model: string | null;
  public readonly effort: string | null;
  private readonly names: Readonly<Record<string, string>>;

  public constructor(model: string | null, effort: string | null) {
    this.model = model;
    this.effort = effort;
    this.names = Object.fromEntries(Object.entries(Resources.codexEffortNames).filter(([t]) => t === effort));
  }

  public static fromConfig(config: JsonReader): CodexModelDefaults {
    return new CodexModelDefaults(CodexModelDefaults.filled(config, Resources.modelField), CodexModelDefaults.filled(config, Resources.modelReasoningEffortSetting));
  }

  public applyTo(models: readonly ProviderModel[]): readonly ProviderModel[] {
    const listed = models.find(t => t.matches(this.model));
    const applied = models.map(t => this.applied(t, t === listed));
    return Object.isUndefined(listed) && !Object.isNull(this.model)
      ? [...applied, this.applied(new ProviderModel(this.model, this.model, String.empty, null, true, null, null), true)] : applied;
  }

  private applied(model: ProviderModel, isDefault: boolean): ProviderModel {
    return new ProviderModel(model.id, model.displayName, model.description, model.effortLevels, isDefault, model.resolvedModel, model.supportsImages,
      model.defaultEffort, { ...this.names, ...model.effortNames }, model.speeds, model.defaultSpeed, model.contextWindows, model.unavailableReason, this.effort);
  }

  private static filled(config: JsonReader, field: string): string | null {
    const value = config.hasField(field) ? config.readNullableString(field) : null;
    return Object.isNull(value) || String.isNullOrWhitespace(value) ? null : value;
  }
}
