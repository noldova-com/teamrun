/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import type { IAppearanceStore } from "@noldova/teamrun-shell-desktop";

export class FakeAppearanceStore implements IAppearanceStore {
  public readonly folders: string[] = [];
  public readonly writes: JsonObject[] = [];
  public kept: JsonObject | null = null;
  public readFailure?: Error;
  public writeFailure?: Error;

  public create(folder: string): FakeAppearanceStore {
    this.folders.push(folder);
    return this;
  }

  public readAsync(): Promise<JsonObject | null> {
    return Object.isUndefined(this.readFailure) ? Promise.resolve(this.kept) : Promise.reject(this.readFailure);
  }

  public writeAsync(preferences: JsonObject): Promise<void> {
    this.writes.push(preferences);
    if (!Object.isUndefined(this.writeFailure))
      return Promise.reject(this.writeFailure);
    this.kept = preferences;
    return Promise.resolve();
  }
}
