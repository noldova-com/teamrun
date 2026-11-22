/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Organization, Teammate } from "@noldova/teamrun.protocol";

import type { IDepartmentRow } from "../../interfaces/i-department-row.js";
import type { ITeammatePlacementRow } from "../../interfaces/i-teammate-placement-row.js";
import { Resources } from "../../resources.js";

export class OrganizationsMigration extends SqlMigration {
  public constructor() {
    super(Resources.organizationsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.executeSql(Resources.deferForeignKeys);
    builder.createTable<Organization>(Resources.organizationsTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id));
    builder.executeSql(Resources.insertDefaultOrganization);
    builder.executeSql(Resources.copyDepartments);
    builder.executeSql(Resources.dropDepartments);
    builder.createTable<IDepartmentRow>(Resources.departmentsTable,
      table => {
        table.addColumn(t => t.id, ColumnType.Text);
        table.addColumn(t => t.organizationId, ColumnType.Text);
        table.addColumn(t => t.parentId, ColumnType.Text).makeNullable();
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
        table.addColumn(t => t.createdAt, ColumnType.Text);
        table.addColumn(t => t.updatedAt, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.id)
        .addForeignKey<Organization>(t => t.organizationId, Resources.organizationsTable, t => t.id)
        .addForeignKey<IDepartmentRow>(t => t.parentId, Resources.departmentsTable, t => t.id));
    builder.createIndex<IDepartmentRow>(Resources.departmentsTable, t => t.organizationId);
    builder.createIndex<IDepartmentRow>(Resources.departmentsTable, t => t.parentId);
    builder.executeSql(Resources.restoreDepartments);
    builder.executeSql(Resources.dropDepartmentsCopy);
    builder.executeSql(Resources.copyTeammatePlacements);
    builder.executeSql(Resources.dropTeammatePlacements);
    builder.createTable<ITeammatePlacementRow>(Resources.teammatePlacementsTable,
      table => {
        table.addColumn(t => t.organizationId, ColumnType.Text);
        table.addColumn(t => t.teammateId, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.organizationId, t => t.teammateId)
        .addForeignKey<Organization>(t => t.organizationId, Resources.organizationsTable, t => t.id)
        .addForeignKey<Teammate>(t => t.teammateId, Resources.teammatesTable, t => t.id));
    builder.createIndex<ITeammatePlacementRow>(Resources.teammatePlacementsTable, t => t.teammateId);
    builder.executeSql(Resources.restoreTeammatePlacements);
    builder.executeSql(Resources.dropTeammatePlacementsCopy);
    builder.executeSql(Resources.moveOrganizationLayout);
  }
}
