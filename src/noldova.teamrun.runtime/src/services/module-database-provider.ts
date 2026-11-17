/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleDatabase } from "@noldova/desktop.runtime";
import type { DataSource } from "@noldova/context.data";
import { SqlProvider } from "@noldova/context.data.sql";

import { ModuleDatabaseConnection } from "./module-database-connection.js";

export class ModuleDatabaseProvider extends SqlProvider {
  private readonly database: IModuleDatabase;

  public constructor(database: IModuleDatabase) {
    super();

    this.database = database;
  }

  public override openConnection(dataSource: DataSource): ModuleDatabaseConnection {
    return new ModuleDatabaseConnection(dataSource, this.database);
  }
}
