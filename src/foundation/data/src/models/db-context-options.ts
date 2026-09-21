/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Connection } from "../services/connection.js";
import type { DataProvider } from "../services/data-provider.js";
import type { DataSource } from "./data-source.js";
import type { Migration } from "./migration.js";

export class DbContextOptions<TConnection extends Connection, TMigration extends Migration> {
  public readonly provider: DataProvider<TConnection, TMigration>;
  public readonly dataSource: DataSource;

  public constructor(provider: DataProvider<TConnection, TMigration>, dataSource: DataSource) {
    this.provider = provider;
    this.dataSource = dataSource;
  }
}
