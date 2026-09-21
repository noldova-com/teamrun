/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transaction } from "@noldova/teamrun-foundation-data";

import { SqlQuery } from "../models/sql-query.js";
import { Resources } from "../resources.js";
import type { SqlConnection } from "./sql-connection.js";

export class SqlTransaction extends Transaction {
  private readonly connection: SqlConnection;

  public constructor(connection: SqlConnection) {
    super();
    connection.execute(new SqlQuery(Resources.beginTransaction));

    this.connection = connection;
  }

  protected override commitCore(): void {
    this.connection.execute(new SqlQuery(Resources.commitTransaction));
  }

  protected override rollbackCore(): void {
    this.connection.execute(new SqlQuery(Resources.rollbackTransaction));
  }
}
