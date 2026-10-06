/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";

import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import { Resources } from "../resources.js";

export class DeviceState {
  private readonly store: IDeviceFileStore;
  private readonly log: (text: string) => void;
  private readonly shown: Set<string> = new Set();
  private state: Promise<JsonObject> | null = null;
  private writing: Promise<void> = Promise.resolve();

  public constructor(store: IDeviceFileStore, log: (text: string) => void) {
    this.store = store;
    this.log = log;
  }

  public readAsync(): Promise<JsonObject> {
    this.state ??= this.loadAsync();
    return this.state;
  }

  public async showOnceAsync(key: string, show: () => boolean): Promise<void> {
    if (this.shown.has(key))
      return;
    this.shown.add(key);
    const state = await this.readAsync();
    if (state[key] === true || !show())
      return;
    await this.rememberAsync(key, true);
  }

  public rememberAsync(key: string, value: JsonValue): Promise<void> {
    this.writing = this.writing.then(async () => {
      const state = { ...await this.readAsync(), [key]: value };
      this.state = Promise.resolve(state);
      await this.store.writeAsync(state);
    }).catch((error: unknown) => this.log(Resources.formatDeviceStateUnsaved(key, String(error))));
    return this.writing;
  }

  private async loadAsync(): Promise<JsonObject> {
    try {
      return await this.store.readAsync() ?? {};
    }
    catch (error) {
      this.log(Resources.formatDeviceStateNotRead(String(error)));
      return {};
    }
  }
}
