/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class WindowStateKey {
  private static readonly FIELDS: readonly string[] = [Resources.deviceField, Resources.windowField];

  public readonly device: string;
  public readonly window: string;

  public constructor(device: string, window: string) {
    ArgumentException.throwIfNullOrWhitespace(device, Resources.deviceField);
    ArgumentException.throwIfNullOrWhitespace(window, Resources.windowField);

    this.device = device;
    this.window = window;
  }

  public static fromJson(value: unknown, path?: string): WindowStateKey {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WindowStateKey.FIELDS);
    return WireContract.create(reader, () => new WindowStateKey(reader.readString(Resources.deviceField), reader.readString(Resources.windowField)));
  }

  public toJson(): JsonObject {
    return { [Resources.deviceField]: this.device, [Resources.windowField]: this.window };
  }
}
