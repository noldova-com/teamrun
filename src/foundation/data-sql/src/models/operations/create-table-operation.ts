/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlDialect } from "../../services/sql-dialect.js";
import type { Table } from "../schema/table.js";
import { SchemaOperation } from "./schema-operation.js";

export class CreateTableOperation extends SchemaOperation {
  public readonly table: Table;

  public constructor(table: Table) {
    super();

    this.table = table;
  }

  public override render(dialect: SqlDialect): string {
    return dialect.renderCreateTable(this.table);
  }
}
