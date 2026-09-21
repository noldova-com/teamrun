/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlMigration } from "@noldova/teamrun-foundation-data-sql";

import { InitialMigration } from "../../migrations/initial-migration.js";
import { TeammatesMigration } from "../../migrations/teammates-migration.js";

export class MigrationCatalog {
  public static readonly all: readonly SqlMigration[] = [new InitialMigration(), new TeammatesMigration()];
}
