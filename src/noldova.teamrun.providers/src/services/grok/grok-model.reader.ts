/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { ProviderModel } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class GrokModelReader {
  public static read(initialized: JsonReader): readonly ProviderModel[] {
    return GrokModelReader.readState(initialized.readObject(Resources.acpMetaField).readObject(Resources.grokModelStateField), initialized);
  }

  public static readState(state: JsonReader, initialized: JsonReader): readonly ProviderModel[] {
    const selected = state.readNonBlankString(Resources.acpCurrentModelField);
    const images = initialized.readObject(Resources.acpCapabilitiesField).readObject(Resources.acpPromptCapabilitiesField)
      .readBoolean(Resources.acpImageCapabilityField);
    return state.readObjectArray(Resources.acpAvailableModelsField).map(row => {
      const id = row.readNonBlankString(Resources.acpModelIdField);
      const info = row.hasField(Resources.acpMetaField) ? row.readObject(Resources.acpMetaField) : JsonReader.fromValue({});
      const listed = info.toJson()[Resources.grokSupportsReasoningEffortField] === true ? info.toJson()[Resources.grokReasoningEffortsField] : [];
      const entries = Array.isArray(listed) ? listed.filter(t => !Object.isNull(GrokModelReader.levelOf(t))) : null;
      const levels = Object.isNull(entries) ? null : [...new Set(entries.map(t => GrokModelReader.levelOf(t)!))];
      const reported = info.toJson()[Resources.grokReasoningEffortField];
      const marked = entries?.find(t => GrokModelReader.fieldOf(t, Resources.grokDefaultField) === true);
      const fallback = Object.isString(reported) ? reported.toLowerCase() : Object.isUndefined(marked) ? null : GrokModelReader.levelOf(marked);
      return new ProviderModel(id, row.readNonBlankString(Resources.nameField), row.readOptionalString(Resources.modelDescriptionField) ?? String.empty,
        levels, id === selected, null, images, !Object.isNull(fallback) && (levels ?? []).includes(fallback) ? fallback : null,
        GrokModelReader.namesOf(entries ?? []));
    });
  }

  private static levelOf(entry: JsonValue): string | null {
    const value = Object.isObject(entry) && !Array.isArray(entry) ? GrokModelReader.fieldOf(entry, Resources.grokValueField) : entry;
    return Object.isString(value) && value.trim().length > 0 ? value.trim().toLowerCase() : null;
  }

  private static fieldOf(entry: JsonValue, field: string): JsonValue | undefined {
    return Object.isObject(entry) && !Array.isArray(entry) ? (entry as JsonObject)[field] : undefined;
  }

  private static namesOf(entries: readonly JsonValue[]): Record<string, string> {
    const names: Record<string, string> = {};
    for (const entry of entries) {
      const label = GrokModelReader.fieldOf(entry, Resources.grokLabelField);
      const level = GrokModelReader.levelOf(entry)!;
      if (Object.isString(label) && label.trim().length > 0 && !Object.hasOwn(names, level))
        names[level] = label.trim();
    }
    return names;
  }

  public static version(initialized: JsonReader): string | null {
    return initialized.readObject(Resources.acpMetaField).readOptionalString(Resources.grokAgentVersionField) ?? null;
  }

  public static canAuthenticate(initialized: JsonReader): boolean {
    return initialized.readObjectArray(Resources.acpAuthMethodsField).some(t => t.readNonBlankString(Resources.idField) === Resources.grokCachedAuthMethod);
  }

  public static signInMethod(initialized: JsonReader): string | null {
    return initialized.readObjectArray(Resources.acpAuthMethodsField).map(t => t.readNonBlankString(Resources.idField))
      .find(t => t !== Resources.grokCachedAuthMethod) ?? null;
  }
}
