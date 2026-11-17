/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";

import { ChangeEntity } from "../../enums/change-entity.js";
import { Resources } from "../../resources.js";

export class ReplyIdentityMigration extends SqlMigration {
  public constructor() {
    super(Resources.replyIdentityMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.executeSql(Resources.formatRemoveJsonField(Resources.messagesTable, Resources.jsonColumn, Resources.replyIdentityPath, {}));
    builder.executeSql(Resources.formatRemoveJsonField(Resources.changesTable, Resources.payloadColumn, Resources.replyIdentityPath,
      { [Resources.entityColumn]: ChangeEntity.Message }));
  }
}
