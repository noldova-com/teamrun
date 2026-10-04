/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migration } from "../../models/migration.js";
import { Resources } from "../../resources.js";

export class ShellMigrations {
  public static readonly all: readonly Migration[] = [
    new Migration(Resources.windowStatesMigration, [Resources.createWindowStatesStatement]),
    new Migration(Resources.quietDevicesMigration, [Resources.createQuietDevicesStatement]),
    new Migration(Resources.settingsMigration, [Resources.createSettingValuesStatement, Resources.createSettingScopesStatement, Resources.copyQuietDevicesStatement]),
    new Migration(Resources.quietDevicesMovedMigration, [Resources.forgetDoNotDisturbStatement, Resources.copyQuietDevicesStatement, Resources.dropQuietDevicesStatement]),
    new Migration(Resources.ownedProcessesMigration, [Resources.createOwnedProcessesStatement])
  ];
}
