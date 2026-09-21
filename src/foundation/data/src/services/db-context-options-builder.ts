/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataSource } from "../models/data-source.js";
import { DbContextOptions } from "../models/db-context-options.js";
import type { Migration } from "../models/migration.js";
import type { Connection } from "./connection.js";
import type { DataProvider } from "./data-provider.js";

export class DbContextOptionsBuilder {
  public use<TConnection extends Connection, TMigration extends Migration>(
    provider: DataProvider<TConnection, TMigration>,
    dataSource: DataSource): DbContextOptions<TConnection, TMigration> {
    return new DbContextOptions(provider, dataSource);
  }
}
