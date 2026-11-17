/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class AccountLimitsMigration extends SqlMigration {
  public constructor() {
    super(Resources.accountLimitsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<{ readonly providerId: string; readonly seenAt: string; readonly resetsAt: string }>(Resources.accountLimitsTable,
      table => {
        table.addColumn(t => t.providerId, ColumnType.Text);
        table.addColumn(t => t.seenAt, ColumnType.Text);
        table.addColumn(t => t.resetsAt, ColumnType.Text).makeNullable();
      },
      constraints => constraints.addPrimaryKey(t => t.providerId));
  }
}
