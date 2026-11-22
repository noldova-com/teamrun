/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ColumnType, type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Teammate, TeammatePlacement } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class TeammatePlacementsMigration extends SqlMigration {
  public constructor() {
    super(Resources.teammatePlacementsMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.createTable<TeammatePlacement>(Resources.teammatePlacementsTable,
      table => {
        table.addColumn(t => t.teammateId, ColumnType.Text);
        table.addColumn(Resources.jsonColumn, ColumnType.Text);
      },
      constraints => constraints.addPrimaryKey(t => t.teammateId)
        .addForeignKey<Teammate>(t => t.teammateId, Resources.teammatesTable, t => t.id));
    builder.executeSql(Resources.copyDepartmentMembersToPlacements);
    builder.executeSql(Resources.placeUnplacedTeammatesUnderPerson);
    builder.executeSql(Resources.dropDepartmentMembers);
    builder.executeSql(Resources.moveDepartmentParentsIntoJson);
  }
}
