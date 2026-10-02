/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { WindowStateKey } from "./window-state-key.js";

export class WindowStateWrite {
  private static readonly FIELDS: readonly string[] = [Resources.deviceField, Resources.windowField, Resources.valueField];

  public readonly key: WindowStateKey;
  public readonly value: JsonObject;

  public constructor(key: WindowStateKey, value: JsonObject) {
    this.key = key;
    this.value = value;
  }

  public static fromJson(value: unknown, path?: string): WindowStateWrite {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WindowStateWrite.FIELDS);
    const state = reader.readObject(Resources.valueField).toJson();
    return WireContract.create(reader, () => new WindowStateWrite(
      new WindowStateKey(reader.readString(Resources.deviceField), reader.readString(Resources.windowField)),
      state));
  }

  public toJson(): JsonObject {
    return { ...this.key.toJson(), [Resources.valueField]: this.value };
  }
}
