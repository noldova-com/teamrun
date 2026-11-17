/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migration } from "@noldova/desktop.runtime";
import { MigrationCatalog } from "@noldova/teamrun.core";
import { MigrationBuilder, type SqlDialect, type SqlMigration } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";

import { Resources } from "../resources.js";
import { Pages } from "./pages/pages.js";

export class HostedMigrations {
  private static readonly DIALECT: SqlDialect = new SQLiteDialect();

  public static readonly all: readonly Migration[] = [...MigrationCatalog.all.map(t => HostedMigrations.toMigration(t)), ...Pages.migrations]
    .sort((a, b) => a.id.localeCompare(b.id));

  private static toMigration(migration: SqlMigration): Migration {
    const builder = new MigrationBuilder();
    migration.apply(builder);
    return new Migration(Resources.formatMigrationId(migration.id), builder.toOperations().map(t => t.render(HostedMigrations.DIALECT)));
  }
}
