/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import type { IDeviceFileStore } from "@noldova/teamrun-shell-desktop";

export class FakeDeviceFileStore implements IDeviceFileStore {
  public readonly writes: JsonObject[] = [];
  public kept: JsonObject | null = null;
  public reads: number = 0;
  public readFailure?: Error;
  public writeFailure?: Error;

  public readAsync(): Promise<JsonObject | null> {
    this.reads++;
    return Object.isUndefined(this.readFailure) ? Promise.resolve(this.kept) : Promise.reject(this.readFailure);
  }

  public writeAsync(value: JsonObject): Promise<void> {
    this.writes.push(value);
    if (!Object.isUndefined(this.writeFailure))
      return Promise.reject(this.writeFailure);
    this.kept = value;
    return Promise.resolve();
  }
}
