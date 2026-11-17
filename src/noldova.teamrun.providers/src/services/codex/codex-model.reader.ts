/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader } from "@noldova/context.json";
import { ProviderModel, ProviderSpeed } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class CodexModelReader {
  public static read(reader: JsonReader): ProviderModel {
    const id = reader.readNonBlankString(Resources.modelField);
    const listed = reader.hasField(Resources.supportedReasoningEffortsField)
      ? reader.readObjectArray(Resources.supportedReasoningEffortsField).map(t => t.readNonBlankString(Resources.reasoningEffortField)) : null;
    const fallback = reader.hasField(Resources.codexDefaultReasoningEffortField) ? reader.readNullableString(Resources.codexDefaultReasoningEffortField) : null;
    const levels = listed?.length === 0 && !Object.isNull(fallback) ? [fallback] : listed;
    const names = Object.fromEntries(Object.entries(Resources.codexEffortNames).filter(([t]) => (levels ?? []).includes(t)));
    const tiers = CodexModelReader.speedsOf(reader);
    const speeds = tiers.length === 0 || tiers.some(t => t.id === Resources.codexStandardTier) ? tiers
      : [new ProviderSpeed(Resources.codexStandardTier, Resources.codexStandardTierName), ...tiers];
    const named = reader.hasField(Resources.codexDefaultServiceTierField) ? reader.readNullableString(Resources.codexDefaultServiceTierField) : null;
    const defaultSpeed = speeds.length === 0 ? null : speeds.some(t => t.id === named) ? named : Resources.codexStandardTier;
    return new ProviderModel(id, reader.readOptionalString(Resources.modelDisplayNameField) ?? id,
      reader.readOptionalString(Resources.modelDescriptionField) ?? String.empty, levels,
      reader.hasField(Resources.modelIsDefaultField) && reader.readBoolean(Resources.modelIsDefaultField), null,
      reader.hasField(Resources.inputModalitiesField) ? reader.readStringArray(Resources.inputModalitiesField).includes(Resources.imageInputType) : null,
      !Object.isNull(fallback) && (levels ?? []).includes(fallback) ? fallback : null, names, speeds, defaultSpeed);
  }

  private static speedsOf(reader: JsonReader): ProviderSpeed[] {
    if (reader.hasField(Resources.codexServiceTiersField))
      return reader.readObjectArray(Resources.codexServiceTiersField).map(t => new ProviderSpeed(t.readNonBlankString(Resources.idField),
        CodexModelReader.filled(t.readOptionalString(Resources.nameField)), CodexModelReader.filled(t.readOptionalString(Resources.descriptionField))));
    return reader.hasField(Resources.codexSpeedTiersField) ? reader.readStringArray(Resources.codexSpeedTiersField).map(t => new ProviderSpeed(t)) : [];
  }

  private static filled(value: string | undefined): string | null {
    return Object.isUndefined(value) || String.isNullOrWhitespace(value) ? null : value.trim();
  }
}
