/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { Resources } from "../../resources.js";

export class TeammateLastRepliesMigration extends SqlMigration {
  public constructor() {
    super(Resources.teammateLastRepliesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.executeSql(Resources.createTeammateLastReplyIndex);
  }
}
