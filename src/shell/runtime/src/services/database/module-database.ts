/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { mkdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";

import type { IModuleDatabase } from "../../interfaces/module-database.js";
import type { Migration } from "../../models/migration.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import { MigratedDatabase } from "./migrated-database.js";

export class ModuleDatabase extends MigratedDatabase implements IModuleDatabase {
  public static async openAsync(directory: DataDirectory, moduleId: string, migrations: readonly Migration[], moment: Date = new Date()): Promise<ModuleDatabase> {
    const file = directory.locateModuleDatabase(moduleId);
    await mkdir(path.dirname(file), { recursive: true });
    const [connection, applied] = await MigratedDatabase.migrateAsync(
      file,
      Resources.formatModuleDatabaseName(moduleId),
      migrations,
      directory.backupsFolder,
      moduleId,
      moment);
    return new ModuleDatabase(connection, applied);
  }
}
