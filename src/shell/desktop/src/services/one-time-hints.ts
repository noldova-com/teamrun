/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import { Resources } from "../resources.js";

export class OneTimeHints {
  private readonly store: IDeviceFileStore;
  private readonly log: (text: string) => void;
  private readonly shown: Set<string> = new Set();

  public constructor(store: IDeviceFileStore, log: (text: string) => void) {
    this.store = store;
    this.log = log;
  }

  public async showOnceAsync(key: string, show: () => boolean): Promise<void> {
    if (this.shown.has(key))
      return;
    this.shown.add(key);
    const state = await this.readAsync();
    if (state[key] === true || !show())
      return;
    await this.store.writeAsync({ ...state, [key]: true }).catch((error: unknown) => this.log(Resources.formatHintUnsaved(key, String(error))));
  }

  private async readAsync(): Promise<JsonObject> {
    try {
      return await this.store.readAsync() ?? {};
    }
    catch (error) {
      this.log(Resources.formatHintsNotRead(String(error)));
      return {};
    }
  }
}
