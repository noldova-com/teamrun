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
import { ProviderContextWindows } from "./provider-context-windows.js";
import { ProviderSpeed } from "./provider-speed.js";

export class ProviderModel {
  public readonly id: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly effortLevels: readonly string[] | null;
  public readonly isDefault: boolean;
  public readonly resolvedModel: string | null;
  public readonly supportsImages: boolean | null;
  public readonly defaultEffort: string | null;
  public readonly effortNames: Readonly<Record<string, string>>;
  public readonly speeds: readonly ProviderSpeed[];
  public readonly defaultSpeed: string | null;
  public readonly contextWindows: ProviderContextWindows | null;
  public readonly unavailableReason: string | null;
  public readonly configuredEffort: string | null;

  public constructor(id: string, displayName: string, description: string, effortLevels: readonly string[] | null,
    isDefault: boolean, resolvedModel: string | null, supportsImages: boolean | null, defaultEffort: string | null = null,
    effortNames: Readonly<Record<string, string>> = {}, speeds: readonly ProviderSpeed[] = [], defaultSpeed: string | null = null,
    contextWindows: ProviderContextWindows | null = null, unavailableReason: string | null = null, configuredEffort: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameField);
    for (const effort of effortLevels ?? [])
      ArgumentException.throwIfNullOrWhitespace(effort, Resources.effortLevelsField);
    if (!Object.isNull(defaultEffort) && !(effortLevels ?? []).includes(defaultEffort))
      throw new ArgumentException(Resources.effortNotListed, Resources.defaultEffortField);
    for (const [level, name] of Object.entries(effortNames)) {
      ArgumentException.throwIfNullOrWhitespace(name, Resources.effortNamesField);
      if (!(effortLevels ?? []).includes(level) && level !== configuredEffort)
        throw new ArgumentException(Resources.effortNotListed, Resources.effortNamesField);
    }
    if (new Set(speeds.map(t => t.id)).size !== speeds.length)
      throw new ArgumentException(Resources.speedRepeated, Resources.speedsField);
    if (!Object.isNull(defaultSpeed) && !speeds.some(t => t.id === defaultSpeed))
      throw new ArgumentException(Resources.speedNotListed, Resources.defaultSpeedField);
    if (!Object.isNull(unavailableReason))
      ArgumentException.throwIfNullOrWhitespace(unavailableReason, Resources.unavailableReasonField);
    if (!Object.isNull(configuredEffort))
      ArgumentException.throwIfNullOrWhitespace(configuredEffort, Resources.configuredEffortField);

    this.id = id;
    this.displayName = displayName;
    this.description = description;
    this.effortLevels = Object.isNull(effortLevels) ? null : [...effortLevels];
    this.isDefault = isDefault;
    this.resolvedModel = resolvedModel;
    this.supportsImages = supportsImages;
    this.defaultEffort = defaultEffort;
    this.effortNames = { ...effortNames };
    this.speeds = [...speeds];
    this.defaultSpeed = defaultSpeed;
    this.contextWindows = contextWindows;
    this.unavailableReason = unavailableReason;
    this.configuredEffort = configuredEffort;
  }

  public static fromJson(value: unknown, path?: string): ProviderModel {
    const reader = JsonReader.fromValue(value, path);
    return new ProviderModel(reader.readNonBlankString(Resources.idField), reader.readNonBlankString(Resources.displayNameField),
      reader.readString(Resources.descriptionField),
      Object.isNull(reader.toJson()[Resources.effortLevelsField]) ? null : reader.readStringArray(Resources.effortLevelsField),
      reader.readBoolean(Resources.isDefaultField), reader.readNullableString(Resources.resolvedModelField),
      Object.isNull(reader.toJson()[Resources.supportsImagesField]) ? null : reader.readBoolean(Resources.supportsImagesField),
      reader.hasField(Resources.defaultEffortField) ? reader.readNullableString(Resources.defaultEffortField) : null,
      ProviderModel.namesFromJson(reader),
      reader.hasField(Resources.speedsField) ? reader.readObjectArray(Resources.speedsField).map(t => ProviderSpeed.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.defaultSpeedField) ? reader.readNullableString(Resources.defaultSpeedField) : null,
      ProviderModel.windowsFromJson(reader),
      reader.hasField(Resources.unavailableReasonField) ? reader.readNullableString(Resources.unavailableReasonField) : null,
      reader.hasField(Resources.configuredEffortField) ? reader.readNullableString(Resources.configuredEffortField) : null);
  }

  private static windowsFromJson(reader: JsonReader): ProviderContextWindows | null {
    const windows = reader.hasField(Resources.contextWindowsField) ? reader.readNullableObject(Resources.contextWindowsField) : null;
    return Object.isNull(windows) ? null : ProviderContextWindows.fromJson(windows.toJson(), windows.path);
  }

  private static namesFromJson(reader: JsonReader): Record<string, string> {
    const names = reader.hasField(Resources.effortNamesField) ? reader.readObject(Resources.effortNamesField) : null;
    return Object.fromEntries(Object.keys(names?.toJson() ?? {}).map(t => [t, names!.readNonBlankString(t)]));
  }

  public matches(id: string | null): boolean {
    return Object.isNull(id) ? this.isDefault : id === this.id || id === this.resolvedModel;
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.displayNameField]: this.displayName,
      [Resources.descriptionField]: this.description,
      [Resources.effortLevelsField]: Object.isNull(this.effortLevels) ? null : [...this.effortLevels],
      [Resources.isDefaultField]: this.isDefault,
      [Resources.resolvedModelField]: this.resolvedModel,
      [Resources.supportsImagesField]: this.supportsImages,
      [Resources.defaultEffortField]: this.defaultEffort,
      [Resources.effortNamesField]: { ...this.effortNames },
      [Resources.speedsField]: this.speeds.map(t => t.toJson()),
      [Resources.defaultSpeedField]: this.defaultSpeed,
      ...Object.isNull(this.contextWindows) ? {} : { [Resources.contextWindowsField]: this.contextWindows.toJson() },
      ...Object.isNull(this.unavailableReason) ? {} : { [Resources.unavailableReasonField]: this.unavailableReason },
      ...Object.isNull(this.configuredEffort) ? {} : { [Resources.configuredEffortField]: this.configuredEffort }
    };
  }
}
