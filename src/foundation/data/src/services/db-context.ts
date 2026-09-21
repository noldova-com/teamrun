/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DbContextOptions } from "../models/db-context-options.js";
import type { Migration } from "../models/migration.js";
import type { Connection } from "./connection.js";
import { DatabaseFacade } from "./database-facade.js";

export abstract class DbContext<TConnection extends Connection, TMigration extends Migration> implements Disposable {
  public readonly database: DatabaseFacade<TConnection, TMigration>;

  protected constructor(options: DbContextOptions<TConnection, TMigration>, migrations: readonly TMigration[]) {
    this.database = new DatabaseFacade(options, migrations);
  }

  public [Symbol.dispose](): void {
    this.database.connection.close();
  }
}
