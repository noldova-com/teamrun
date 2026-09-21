/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Index } from "@noldova/teamrun-foundation-data";

import type { SqlDialect } from "../../services/sql-dialect.js";
import { SchemaOperation } from "./schema-operation.js";

export class CreateIndexOperation extends SchemaOperation {
  public readonly index: Index;

  public constructor(index: Index) {
    super();

    this.index = index;
  }

  public override render(dialect: SqlDialect): string {
    return dialect.renderCreateIndex(this.index);
  }
}
