/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { OrganizationMessage } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class OrganizationMessagesMigration extends SqlMigration {
  public constructor() {
    super(Resources.organizationMessagesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<OrganizationMessage>(Resources.organizationMessagesTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id));
  }
}
