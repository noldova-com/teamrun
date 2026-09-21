/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, SqlDialect } from "@noldova/teamrun-foundation-data-sql";

export class TestDialect extends SqlDialect {
  public override formatColumnType(type: ColumnType): string {
    return type === ColumnType.Integer ? "INTEGER" : "TEXT";
  }
}
