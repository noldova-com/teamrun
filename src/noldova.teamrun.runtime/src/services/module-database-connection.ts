/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleDatabase } from "@noldova/desktop.runtime";
import type { DataSource } from "@noldova/context.data";
import { SqlConnection, type SqlDialect } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";

import { Resources } from "../resources.js";
import { ModuleDatabaseSession } from "./module-database-session.js";

export class ModuleDatabaseConnection extends SqlConnection {
  private readonly sqliteDialect: SqlDialect = new SQLiteDialect();

  public constructor(dataSource: DataSource, database: IModuleDatabase) {
    database.run(Resources.foreignKeysStatement);
    super(dataSource, new ModuleDatabaseSession(database));
  }

  public override get dialect(): SqlDialect {
    return this.sqliteDialect;
  }
}
