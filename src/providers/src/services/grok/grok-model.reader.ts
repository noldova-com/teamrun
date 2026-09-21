/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { ProviderModel } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";

export class GrokModelReader {
  public static read(initialized: JsonReader): readonly ProviderModel[] {
    const meta = initialized.readObject(Resources.grokMetaField);
    const state = meta.readObject(Resources.grokModelStateField);
    const selected = state.readNonBlankString(Resources.grokCurrentModelField);
    const images = initialized.readObject(Resources.grokCapabilitiesField).readObject(Resources.grokPromptCapabilitiesField)
      .readBoolean(Resources.grokImageCapabilityField);
    return state.readObjectArray(Resources.grokAvailableModelsField).map(row => {
      const id = row.readNonBlankString(Resources.grokModelIdField);
      const info = row.hasField(Resources.grokMetaField) ? row.readObject(Resources.grokMetaField) : JsonReader.fromValue({});
      const efforts = info.hasField(Resources.grokReasoningEffortsField)
        ? info.readObjectArray(Resources.grokReasoningEffortsField).map(t => t.readNonBlankString(Resources.grokValueField)) : null;
      return new ProviderModel(id, row.readNonBlankString(Resources.nameField), row.readOptionalString(Resources.modelDescriptionField) ?? String.empty,
        efforts, id === selected, null, images);
    });
  }

  public static version(initialized: JsonReader): string | null {
    return initialized.readObject(Resources.grokMetaField).readOptionalString(Resources.grokAgentVersionField) ?? null;
  }

  public static canAuthenticate(initialized: JsonReader): boolean {
    return initialized.readObjectArray(Resources.grokAuthMethodsField).some(t => t.readNonBlankString(Resources.idField) === Resources.grokCachedAuthMethod);
  }
}
