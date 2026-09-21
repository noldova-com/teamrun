/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonReader } from "@noldova/teamrun-foundation-json";
import { ProviderModel } from "@noldova/teamrun-protocol";

import { Resources } from "../../resources.js";

export class CodexModelReader {
  public static read(reader: JsonReader): ProviderModel {
    const id = reader.readNonBlankString(Resources.modelField);
    return new ProviderModel(id, reader.readOptionalString(Resources.modelDisplayNameField) ?? id,
      reader.readOptionalString(Resources.modelDescriptionField) ?? String.empty,
      reader.hasField(Resources.supportedReasoningEffortsField)
        ? reader.readObjectArray(Resources.supportedReasoningEffortsField).map(t => t.readNonBlankString(Resources.reasoningEffortField)) : null,
      reader.hasField(Resources.modelIsDefaultField) && reader.readBoolean(Resources.modelIsDefaultField), null,
      reader.hasField(Resources.inputModalitiesField) ? reader.readStringArray(Resources.inputModalitiesField).includes(Resources.imageInputType) : null);
  }
}
