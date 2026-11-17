/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class ModuleDatabases {
  private static readonly MODULES_FOLDER: string = "modules";
  private static readonly DATABASE: RegExp = /\.(sqlite|db)$/;
  private static readonly TABLE_QUERY: string = "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?";

  public static find(data: string): readonly string[] {
    const found: string[] = [];
    ModuleDatabases.collect(path.join(data, ModuleDatabases.MODULES_FOLDER), found);
    return found;
  }

  public static hasTable(database: DatabaseSync, table: string): boolean {
    return database.prepare(ModuleDatabases.TABLE_QUERY).all(table).length > 0;
  }

  private static collect(folder: string, found: string[]): void {
    for (const entry of existsSync(folder) ? readdirSync(folder, { withFileTypes: true }) : []) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory())
        ModuleDatabases.collect(full, found);
      else if (ModuleDatabases.DATABASE.test(entry.name))
        found.push(full);
    }
  }
}
