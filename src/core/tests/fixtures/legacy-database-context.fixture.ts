/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import "@noldova/teamrun-foundation-data-sql-sqlite";
import { DbContext, DbContextOptionsBuilder } from "@noldova/teamrun-foundation-data";
import type { SqlConnection, SqlMigration } from "@noldova/teamrun-foundation-data-sql";
import { InitialMigration } from "@noldova/teamrun-core";

export class LegacyDatabaseContext extends DbContext<SqlConnection, SqlMigration> {
  public constructor(directory: string) {
    super(new DbContextOptionsBuilder().useSQLite(join(directory, "teamrun.db")), [new InitialMigration()]);
    this.database.migrate();
  }
}
