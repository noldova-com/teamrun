/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataSource } from "@noldova/teamrun-foundation-data";
import { SqlProvider } from "@noldova/teamrun-foundation-data-sql";

import { SQLiteConnection } from "./sqlite-connection.js";

export class SQLiteProvider extends SqlProvider {
  public override openConnection(dataSource: DataSource): SQLiteConnection {
    return SQLiteConnection.open(dataSource);
  }
}
