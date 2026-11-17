/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { ProviderModel, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class CopilotModelReader {
  public static read(answer: JsonReader): readonly ProviderModel[] {
    const models = CopilotModelReader.readRows(answer);
    return models.map(t => t.id === Resources.copilotAutoModelId && t.effortLevels?.length === 0 ? CopilotModelReader.withEveryLevel(t, models) : t);
  }

  private static readRows(answer: JsonReader): readonly ProviderModel[] {
    return answer.readObjectArray(Resources.copilotModelListField).filter(t => CopilotModelReader.isOffered(t)).map(row => {
      const id = row.readNonBlankString(Resources.idField);
      const capabilities = CopilotModelReader.child(row, Resources.copilotCapabilitiesField);
      const supporting = CopilotModelReader.child(capabilities, Resources.copilotSupportsField);
      const supports = supporting.toJson();
      const efforts = row.hasField(Resources.copilotReasoningEffortsField) ? row.readStringArray(Resources.copilotReasoningEffortsField)
        : Array.isArray(supports[Resources.copilotListedReasoningEffortField]) ? supporting.readStringArray(Resources.copilotListedReasoningEffortField)
        : supports[Resources.copilotReasoningEffortField] === true ? null : [];
      const fallback = row.toJson()[Resources.copilotDefaultReasoningEffortField];
      const name = row.readOptionalString(Resources.nameField)?.trim() ?? String.empty;
      const vision = supports[Resources.copilotVisionField];
      return new ProviderModel(id, name.length === 0 ? id : name, String.empty, efforts, false, null, Object.isBoolean(vision) ? vision : null,
        Object.isString(fallback) && (efforts ?? []).includes(fallback) ? fallback : null);
    });
  }

  private static withEveryLevel(auto: ProviderModel, models: readonly ProviderModel[]): ProviderModel {
    const rank = (level: string): number => {
      const index = ProtocolResources.effortLevelOrder.indexOf(level);
      return index < 0 ? ProtocolResources.effortLevelOrder.length : index;
    };
    const levels = [...new Set(models.flatMap(t => t.effortLevels ?? []))].sort((a, b) => rank(a) - rank(b));
    return new ProviderModel(auto.id, auto.displayName, auto.description, levels, auto.isDefault, auto.resolvedModel, auto.supportsImages);
  }

  private static isOffered(row: JsonReader): boolean {
    const id = row.toJson()[Resources.idField];
    const policy = CopilotModelReader.child(row, Resources.copilotPolicyField);
    return Object.isString(id) && ProtocolResources.modelNamePattern.test(id)
      && policy.readOptionalString(Resources.copilotPolicyStateField) !== Resources.copilotDisabledPolicy;
  }

  private static child(row: JsonReader, field: string): JsonReader {
    return row.hasField(field) ? row.readNullableObject(field) ?? JsonReader.fromValue({}) : JsonReader.fromValue({});
  }
}
