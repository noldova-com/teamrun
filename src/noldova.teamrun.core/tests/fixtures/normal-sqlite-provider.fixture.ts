/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataSource } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { SQLiteProvider, type SQLiteConnection } from "@noldova/context.data.sql.sqlite";

export class NormalSQLiteProvider extends SQLiteProvider {
  private static readonly SYNCHRONOUS_PRAGMA: string = "PRAGMA synchronous = NORMAL";

  public override openConnection(dataSource: DataSource): SQLiteConnection {
    const connection = super.openConnection(dataSource);
    void connection.executeAsync(new SqlQuery(NormalSQLiteProvider.SYNCHRONOUS_PRAGMA));
    return connection;
  }
}
