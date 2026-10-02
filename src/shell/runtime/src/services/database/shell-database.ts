/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import "@noldova/teamrun-foundation-core";

import { DataDirectoryState } from "../../enums/data-directory-state.js";
import { PreShellDataException } from "../../exceptions/pre-shell-data.exception.js";
import type { Migration } from "../../models/migration.js";
import { Resources } from "../../resources.js";
import { DataDirectoryInspector } from "../data-directory/data-directory-inspector.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";
import { MigratedDatabase } from "./migrated-database.js";

export class ShellDatabase extends MigratedDatabase {
  public static async openAsync(lock: OwnershipLock, migrations: readonly Migration[], moment: Date = new Date()): Promise<ShellDatabase> {
    lock.requireHeld();
    const directory = lock.dataDirectory;
    const inspection = await DataDirectoryInspector.inspectAsync(directory);
    if (inspection.state === DataDirectoryState.PreShell)
      throw new PreShellDataException(directory.root, inspection.entries);

    const [connection, applied] = await MigratedDatabase.migrateAsync(
      directory.shellDatabase,
      Resources.shellDatabaseName,
      migrations,
      directory.backupsFolder,
      Resources.reservedModuleId,
      moment);
    return new ShellDatabase(connection, applied);
  }
}
