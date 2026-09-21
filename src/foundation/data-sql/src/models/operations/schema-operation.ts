/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlDialect } from "../../services/sql-dialect.js";

export abstract class SchemaOperation {
  public abstract render(dialect: SqlDialect): string;
}
