/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class OrganizationChatFoldersMigration extends SqlMigration {
  public constructor() {
    super(Resources.organizationChatFoldersMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    for (const statement of Resources.keepOrganizationChatFolders)
      builder.executeSql(statement);
  }
}
