/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FakeDeviceIdentity {
  public static readonly ID: string = "11111111-2222-4333-8444-555555555555";

  public readonly folders: string[] = [];
  public failure?: Error;

  public readAsync(folder: string): Promise<string> {
    this.folders.push(folder);
    return Object.isUndefined(this.failure) ? Promise.resolve(FakeDeviceIdentity.ID) : Promise.reject(this.failure);
  }
}
