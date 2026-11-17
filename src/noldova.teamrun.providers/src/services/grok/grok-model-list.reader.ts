/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import type { ProviderModel } from "@noldova/teamrun.protocol";

import type { IAcpModelListReader } from "../../interfaces/i-acp-model-list.reader.js";
import { Resources } from "../../resources.js";
import { GrokModelReader } from "./grok-model.reader.js";

export class GrokModelListReader implements IAcpModelListReader {
  public readonly methods: readonly string[] = Resources.xaiModelListMethods;

  public read(answer: JsonValue, initialized: JsonReader): readonly ProviderModel[] | null {
    const reader = JsonReader.fromValue(answer);
    return reader.hasField(Resources.resultField) ? GrokModelReader.readState(reader.readObject(Resources.resultField), initialized) : null;
  }
}
