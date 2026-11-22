/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import type { IOrganizationMessageRow } from "../../interfaces/i-organization-message-row.js";
import { Resources } from "../../resources.js";

export class OrganizationMessagesMigration extends SqlMigration {
  public constructor() {
    super(Resources.organizationMessagesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<IOrganizationMessageRow>(Resources.organizationMessagesTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id));
  }
}
