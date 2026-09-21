/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, SqlDialect } from "@noldova/teamrun-foundation-data-sql";

import { Resources } from "../resources.js";

export class SQLiteDialect extends SqlDialect {
  public override formatColumnType(type: ColumnType): string {
    return type === ColumnType.Integer ? Resources.integerType : Resources.textType;
  }
}
