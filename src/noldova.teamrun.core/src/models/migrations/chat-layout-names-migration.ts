/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class ChatLayoutNamesMigration extends SqlMigration {
  public constructor() {
    super(Resources.chatLayoutNamesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.executeSql(Resources.createChangesTable);
    for (const field of Resources.renamedLayoutFields) {
      builder.executeSql(Resources.formatRenameJsonField(field.table, Resources.jsonColumn, field.from, field.to, { [Resources.nameColumn]: Resources.projectsLayoutPreference }));
      builder.executeSql(Resources.formatRenameJsonField(Resources.changesTable, Resources.payloadColumn, field.from, field.to,
        { [Resources.entityColumn]: field.entity, [Resources.entityIdColumn]: Resources.projectsLayoutPreference }));
    }
  }
}
