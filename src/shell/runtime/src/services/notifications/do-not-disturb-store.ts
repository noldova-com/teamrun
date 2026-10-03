/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ShellDatabase } from "../database/shell-database.js";
import { Resources } from "../../resources.js";

export class DoNotDisturbStore {
  private readonly database: ShellDatabase;
  private readonly devices: Set<string>;

  public constructor(database: ShellDatabase, devices: Set<string>) {
    this.database = database;
    this.devices = devices;
    for (const row of database.readAll(Resources.readQuietDevicesStatement))
      devices.add(String(row[Resources.deviceColumn]));
  }

  public isQuiet(device: string): boolean {
    return this.devices.has(device);
  }

  public set(device: string, isOn: boolean): void {
    this.database.run(isOn ? Resources.addQuietDeviceStatement : Resources.removeQuietDeviceStatement, device);
    if (isOn)
      this.devices.add(device);
    else
      this.devices.delete(device);
  }
}
