/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class PreferencesMigration extends SqlMigration {
  public constructor() {
    super(Resources.preferencesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly name: string; readonly updatedAt: string }>(Resources.preferencesTable,
      table => {
        table.addColumn(t => t.name, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.name));
  }
}
