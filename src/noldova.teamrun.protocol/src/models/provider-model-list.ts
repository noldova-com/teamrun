/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { ProviderMode } from "./provider-mode.js";
import { ProviderModel } from "./provider-model.js";

export class ProviderModelList {
  public readonly models: readonly ProviderModel[];
  public readonly signedIn: boolean | null;
  public readonly empty: boolean;
  public readonly planName: string | null;
  public readonly awaitsTurn: boolean;
  public readonly modes: readonly ProviderMode[];
  public readonly defaultMode: string | null;
  public readonly defaultTakesListedEfforts: boolean;

  public readonly planMode: string | null;
  public readonly partial: boolean;

  public constructor(models: readonly ProviderModel[], signedIn: boolean | null, empty: boolean = false, planName: string | null = null,
    awaitsTurn: boolean = false, modes: readonly ProviderMode[] = [], defaultMode: string | null = null, defaultTakesListedEfforts: boolean = false,
    planMode: string | null = null, partial: boolean = false) {
    if (new Set(modes.map(t => t.id)).size !== modes.length)
      throw new ArgumentException(Resources.modeRepeated, Resources.modesField);
    if (!Object.isNull(defaultMode) && !modes.some(t => t.id === defaultMode))
      throw new ArgumentException(Resources.modeNotListed, Resources.defaultModeField);
    if (!Object.isNull(planMode) && !modes.some(t => t.id === planMode))
      throw new ArgumentException(Resources.modeNotListed, Resources.planModeField);
    this.models = [...models];
    this.signedIn = signedIn;
    this.empty = empty;
    this.planName = planName;
    this.awaitsTurn = awaitsTurn;
    this.modes = [...modes];
    this.defaultMode = defaultMode;
    this.defaultTakesListedEfforts = defaultTakesListedEfforts;
    this.planMode = planMode;
    this.partial = partial;
  }

  public static fromJson(value: unknown, path?: string): ProviderModelList {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderModelList(reader.readObjectArray(Resources.modelsField).map(t => ProviderModel.fromJson(t.toJson(), t.path)),
      Object.isNull(reader.toJson()[Resources.signedInField]) ? null : reader.readBoolean(Resources.signedInField),
      reader.hasField(Resources.emptyField) ? reader.readBoolean(Resources.emptyField) : false,
      reader.hasField(Resources.planNameField) ? reader.readNullableString(Resources.planNameField) : null,
      reader.hasField(Resources.awaitsTurnField) ? reader.readBoolean(Resources.awaitsTurnField) : false,
      reader.hasField(Resources.modesField) ? reader.readObjectArray(Resources.modesField).map(t => ProviderMode.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.defaultModeField) ? reader.readNullableString(Resources.defaultModeField) : null,
      reader.hasField(Resources.defaultTakesListedEffortsField) ? reader.readBoolean(Resources.defaultTakesListedEffortsField) : false,
      reader.hasField(Resources.planModeField) ? reader.readNullableString(Resources.planModeField) : null,
      reader.hasField(Resources.partialField) ? reader.readBoolean(Resources.partialField) : false);
  }

  public toJson(): JsonObject {
    return {
      [Resources.modelsField]: this.models.map(t => t.toJson()),
      [Resources.signedInField]: this.signedIn,
      [Resources.emptyField]: this.empty,
      [Resources.planNameField]: this.planName,
      [Resources.awaitsTurnField]: this.awaitsTurn,
      [Resources.modesField]: this.modes.map(t => t.toJson()),
      [Resources.defaultModeField]: this.defaultMode,
      [Resources.defaultTakesListedEffortsField]: this.defaultTakesListedEfforts,
      ...Object.isNull(this.planMode) ? {} : { [Resources.planModeField]: this.planMode },
      ...this.partial ? { [Resources.partialField]: true } : {}
    };
  }

  public withPlanMode(planMode: string | null): ProviderModelList {
    return new ProviderModelList(this.models, this.signedIn, this.empty, this.planName, this.awaitsTurn, this.modes, this.defaultMode,
      this.defaultTakesListedEfforts, planMode, this.partial);
  }
}
