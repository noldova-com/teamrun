/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";

import type { ILayoutStore } from "../interfaces/i-layout-store";

@Injectable({ providedIn: "root" })
export class LayoutStoreService implements ILayoutStore {
  private saved: JsonObject | null = null;

  public readAsync(): Promise<JsonValue | null> {
    return Promise.resolve(this.saved);
  }

  public writeAsync(layout: JsonObject): Promise<void> {
    this.saved = layout;
    return Promise.resolve();
  }
}
