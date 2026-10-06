/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { type QualifiedName, type Response, type SettingChange, SettingEntry, SettingKey } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../resources.js";

export class DeviceSettingFollower {
  private readonly name: QualifiedName;
  private readonly readAsync: (key: SettingKey) => Promise<Response>;
  private readonly onChange: (value: JsonValue) => void;
  private readonly log: (text: string) => void;
  private current: JsonValue;
  private generation: number = 0;

  public constructor(name: QualifiedName, initial: JsonValue, readAsync: (key: SettingKey) => Promise<Response>, onChange: (value: JsonValue) => void, log: (text: string) => void) {
    this.name = name;
    this.current = initial;
    this.readAsync = readAsync;
    this.onChange = onChange;
    this.log = log;
  }

  public get value(): JsonValue {
    return this.current;
  }

  public async refreshAsync(device: string): Promise<void> {
    const generation = ++this.generation;
    const response = await this.readAsync(new SettingKey(this.name, null, device));
    if (generation !== this.generation)
      return;
    const failure = response.failure;
    if (!Object.isUndefined(failure)) {
      this.log(Resources.formatSettingNotRead(this.name.text, failure.message));
      return;
    }
    try {
      this.set(SettingEntry.fromJson(response.payload).value);
    }
    catch (error) {
      this.log(Resources.formatSettingNotRead(this.name.text, String(error)));
    }
  }

  public receive(change: SettingChange, device: string | null): void {
    if (change.key.name.text !== this.name.text || change.key.device !== device || !Object.isNull(change.key.scope))
      return;
    this.generation++;
    this.set(change.value);
  }

  private set(value: JsonValue): void {
    if (JSON.stringify(value) === JSON.stringify(this.current))
      return;
    this.current = value;
    this.onChange(value);
  }
}
