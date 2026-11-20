/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Department, DepartmentMember, Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class DepartmentsMigration extends SqlMigration {
  public constructor() {
    super(Resources.departmentsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<Department>(Resources.departmentsTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.parentId, ColumnType.Text).makeNullable();
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id)
        .addForeignKey<Department>(t => t.parentId, Resources.departmentsTable, t => t.id));
    builder.createIndex<Department>(Resources.departmentsTable, t => t.parentId);
    builder.createTable<DepartmentMember>(Resources.departmentMembersTable,
      table => {
        table.addColumn(t => t.teammateId, ColumnType.Text);
        table.addColumn(t => t.departmentId, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.teammateId)
        .addForeignKey<Teammate>(t => t.teammateId, Resources.teammatesTable, t => t.id)
        .addForeignKey<Department>(t => t.departmentId, Resources.departmentsTable, t => t.id));
    builder.createIndex<DepartmentMember>(Resources.departmentMembersTable, t => t.departmentId);
  }
}
